import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  const { plan, submissionId } = req.body

  const prices = {
    reply: process.env.VITE_STRIPE_REPLY_PRICE,
    sub:   process.env.VITE_STRIPE_SUB_PRICE,
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: plan === 'sub' ? 'subscription' : 'payment',
    line_items: [{ price: prices[plan], quantity: 1 }],
    success_url: `${process.env.VITE_APP_URL}/success?submission=${submissionId}`,
    cancel_url: `${process.env.VITE_APP_URL}/submit`,
    metadata: { submissionId, plan },
  })

  res.json({ url: session.url })
}