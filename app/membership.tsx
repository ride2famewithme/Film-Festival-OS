import { BadgePercent, Crown, Gift, History, Sparkles, WalletCards } from 'lucide-react-native';
import { OSHub } from '@/components/OSHub';
export default function MembershipScreen(){return <OSHub eyebrow="LOYALTY" title="Membership & Festival Credits™" subtitle="A separate membership and loyalty layer with transparent rules, controlled discounts and an auditable credits ledger." statusTitle="Separate systems" statusText="Membership status and Festival Credits™ remain distinct; commercial values stay configurable until approved." items={[
{title:'Membership Tiers',detail:'Eligibility, benefits, duration and festival-controlled membership rules.',icon:Crown},
{title:'Discounts & Waivers',detail:'Campaign codes, validity windows, category scope and usage limits.',icon:BadgePercent},
{title:'Festival Credits™',detail:'Closed-loop loyalty credits with immutable transaction history.',icon:Sparkles},
{title:'Benefits Wallet',detail:'Eligible offers and creator/festival benefits.',icon:Gift},
{title:'Credits Ledger',detail:'Earn, redeem, adjustment and reason history.',icon:History,badge:'BACKEND'},
{title:'Payments Link',detail:'Membership payments use the provider-neutral payment architecture.',icon:WalletCards,badge:'BACKEND'},
]}/>}
