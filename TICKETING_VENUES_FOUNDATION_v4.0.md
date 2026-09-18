# Film Festival OS™ — Ticketing, Venues & Audience Acquisition Foundation

**Block:** Ticketing / Venue / Public Directory Foundation  
**Date:** 18 Sep 2026  
**Status:** CODED ON FEATURE BRANCH — REQUIRES MIGRATION + APP TESTING

## Why this block exists

Film Festival OS™ already had ticketing listed as a future external adapter. This block promotes ticketing into a provider-neutral native domain so Film Festival OS™ can support film festivals and, later, Encore™ music/concert operations without becoming locked to one ticket vendor.

A current market review also supports the public-directory requirement: FilmFreeway's published help material says new online-only festivals are handled as non-public listings rather than normal public-directory entries, while Eventive demonstrates that ticketing + virtual/hybrid delivery is already a mature competitor capability. Therefore Film Festival OS™ should not claim that hybrid ticketing is unique; its stronger differentiation is the combined multi-tenant/franchise OS, public discovery, native/provider-neutral ticket domain, streaming entitlement, acquisition attribution and Film/Encore reuse.

## Core decisions

1. **Native data model first.** Venues, events, ticket types, orders, tickets, seating and attribution belong to Film Festival OS™.
2. **External ticket companies are adapters, not the source of truth.** Eventbrite, Ticketebo or another provider may be linked when an operator chooses them.
3. **In-person, online and hybrid are first-class delivery modes.**
4. **Public directory opt-in.** A published festival may choose to appear in a Film Festival OS™ discovery directory and identify its delivery mode.
5. **Safe capacity is declared, not calculated.** The venue/operator records the approved or declared occupancy/capacity and its source. Film Festival OS™ may enforce that number; it must not certify it.
6. **Seat allocation is event-specific.** Venue seats are reusable; their event state is available / held / sold / blocked.
7. **Paid acquisition must connect to orders.** Orders include source/campaign and UTM attribution fields so a later marketing engine can trace campaigns to ticket revenue.
8. **Streaming access and ticketing remain connected but separate.** A ticket can unlock Film Festival OS™ streaming or an external link without putting raw stream credentials into public pages.
9. **No unsupported competitive claim.** Eventive already combines film-festival ticketing, reserved seating and virtual/hybrid delivery. Film Festival OS™ differentiates at the operating-system/franchise/network layer and through provider choice.
10. **External providers are optional accelerators.** Ticketebo and Eventbrite patterns inform seat maps, capacity, scanning/check-in and sales-channel integration, while Film Festival OS™ retains its own canonical event/order IDs.

## Reused ideas from the supplied Excel workbooks

The user-supplied Ticket Manager workbook already models:
- rooms/locations;
- seat rows and columns;
- seat types;
- ticket types and prices;
- purchase status;
- event date/time/duration;
- total and available seats;
- purchaser details;
- assigned seats.

Those concepts are carried forward into normalized Supabase tables, while spreadsheet-specific UI/macros are not copied.

## Current implementation

- Festival profile: delivery mode + public-directory opt-in + slug.
- Public directory screen with IN-PERSON / ONLINE / HYBRID filters.
- Venue table with declared safe capacity and capacity-source fields.
- Ticketed event table with native/Eventbrite/Ticketebo provider selection.
- Ticket types.
- Venue seats and per-event seat inventory foundation.
- Orders with acquisition attribution.
- Tickets with check-in fields and barcode-token-hash field.
- Ticketing workflow service.
- Ticketing & Venues control screen.
- Navigation entries from Festival Workspace, Integrations and Marketing.

## Paid acquisition data path

Planned canonical funnel:

**Campaign / ad source → tracking link / UTM → order → ticket/pass → venue check-in or streaming entitlement/view → revenue/conversion reporting**

The order is the commercial attribution anchor. Advertising platforms may be connected later through explicit adapters, but raw campaign metadata remains provider-neutral in Film Festival OS™.

## Venue and capacity principle

For a physical venue the operator records:
- declared safe capacity;
- seated and/or standing capacity where relevant;
- accessible-seat inventory;
- source/reference for the capacity figure;
- verification date where appropriate.

The application may use these fields as hard ticket-inventory ceilings after the capacity-enforcement block is implemented. The application must not derive a legal occupancy limit from floor area or guess a safe number.

## Next ticketing blocks

- Venue picker/editor and reusable graphical seat maps.
- Capacity-enforcement RPC/database guard before any native sales go live.
- Atomic seat-hold RPC with expiry to prevent double-booking.
- Native checkout payment-provider adapter.
- QR/barcode generation and door scan validation.
- Refund/cancellation workflow.
- Ticketebo adapter.
- Eventbrite adapter.
- Streaming entitlement generated from paid/complimentary ticket state.
- Passes/multi-event bundles/memberships.
- Public event pages and ticket links.
- Paid acquisition reporting: cost per order/pass, ROAS, channel/source attribution.
- Encore™ reuse: concerts, standing/seated mixed venues, artist events and music passes.

## Test boundary

This branch is a construction foundation. It has not yet been migrated into the live Supabase project, exercised through the local Expo build, payment-tested, penetration-tested or production released.
