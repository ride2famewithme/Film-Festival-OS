import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await callerClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid login session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body = await req.json();

    const email = String(body?.email ?? '').trim().toLowerCase();
    const tenantId = String(body?.tenant_id ?? '').trim();
    const role = String(body?.role ?? 'festival_staff').trim();

    if (!['festival_staff', 'juror'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Role must be festival_staff or juror' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email address required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: 'Tenant is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: canManage, error: permissionError } =
      await callerClient.rpc('can_manage_people', {
        p_tenant_id: tenantId,
      });

    if (permissionError || canManage !== true) {
      return new Response(
        JSON.stringify({ error: 'You do not have permission to invite people to this workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email);

    if (inviteError || !inviteData.user) {
      console.error('STAFF_INVITE_FAILED', {
        message: inviteError?.message,
        code: inviteError?.code,
        status: inviteError?.status,
        email,
      });

      return new Response(
        JSON.stringify({
          error: inviteError?.message ?? 'Unable to create invitation',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const invitedUserId = inviteData.user.id;

    const { error: insertError } =
      await admin
        .from('memberships')
        .insert({
          user_id: invitedUserId,
          tenant_id: tenantId,
          role,
          status: 'invited',
        });

    if (insertError) {
      console.error('MEMBERSHIP_INSERT_FAILED', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        invitedUserId,
        tenantId,
      });

      await admin.auth.admin.deleteUser(invitedUserId);

      return new Response(
        JSON.stringify({ error: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        email,
        user_id: invitedUserId,
        role,
        status: 'invited',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unexpected server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
