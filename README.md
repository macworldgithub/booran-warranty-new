This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Loan vehicle handover

The **Issue Loaner** and **Start Test Drive** actions on Loan Operations use the same five sections as the technician/service-advisor flow: customer and driver licence, vehicle and return schedule, outbound condition with five photo slots, terms and acknowledgements, and a customer signature. All backend-required customer/vehicle fields are collected from the user. The five condition photos and licence photo are optional and support camera or file selection.

Clerks can issue and sign only at their assigned active rooftops. Booked handovers retain their rooftop and exact start/return times. The portal creates a draft, then calls the signature endpoint; it reports success only when the backend confirms ACTIVE. Failed signing can be retried on the same draft, including through **Complete handover** after closing the wizard. Server issue failures retain the form and never create a local active loan.

Service Advisors use Warranty Clerk (`CLERK`) accounts for this workflow; no Technician login is required. Clerk navigation exposes Loan Operations on desktop and Loaners on mobile. The booking calendar supports viewing, creating and cancelling reservations within the assigned rooftops. Non-admin accounts with no rooftop assignment do not receive access to a fallback dealership. A separate Service Advisor authentication role is not introduced by this change.

Deploy the portal with the backend changes that preserve the odometer/dashboard photo and the selected deposit. No technician PWA deployment is required for this portal change.

Browser verification, using local mocked API responses and Chrome:

```bash
npm run build
npm run test:loans
```

The test starts the built portal on port 3187. To use an already running local portal, set `PORTAL_URL` instead. It checks clerk rooftop scoping, five photos, required signature, draft activation/recovery, backend rejection, reservation handover, test-drive scheduling and mobile layout. No real loans are issued.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
