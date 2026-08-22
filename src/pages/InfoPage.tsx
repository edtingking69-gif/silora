import { Link } from '@/components/router/Router';

type InfoPageKind = 'about' | 'contact' | 'privacy' | 'terms';

const content: Record<InfoPageKind, { title: string; intro: string; sections: { heading: string; body: string }[] }> = {
  about: {
    title: 'About SILORA',
    intro: 'SILORA is a thoughtful online store for useful products, dependable service, and a checkout experience that stays clear from start to finish.',
    sections: [{ heading: 'What we value', body: 'We focus on honest product information, careful order handling, and responsive support for every customer.' }],
  },
  contact: {
    title: 'Contact SILORA',
    intro: 'Our support team is here to help with products, orders, payments, and delivery updates.',
    sections: [{ heading: 'Support', body: 'For help with an order, sign in and open your account orders page so our team can quickly locate the correct details.' }],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'SILORA uses the information needed to authenticate customers, fulfill orders, process payment submissions, and provide support.',
    sections: [{ heading: 'Your information', body: 'Account and order data is stored in Supabase and protected by database access policies. We never store customer passwords in application tables.' }],
  },
  terms: {
    title: 'Terms of Service',
    intro: 'By using SILORA, you agree to provide accurate account, address, and payment-submission information.',
    sections: [{ heading: 'Orders and payment verification', body: 'Orders are confirmed after the submitted payment is manually verified. Product availability and delivery status are shown from the current order record.' }],
  },
};

export function InfoPage({ kind }: { kind: InfoPageKind }) {
  const page = content[kind];
  return (
    <div className="container-silora py-10 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="text-sm font-semibold text-primary-600 hover:text-primary-700">Back to SILORA</Link>
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">{page.title}</h1>
        <p className="mt-4 text-base leading-7 text-ink-600">{page.intro}</p>
        <div className="mt-10 space-y-8">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-bold text-ink-900">{section.heading}</h2>
              <p className="mt-2 leading-7 text-ink-600">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}