import path from "path"
import { fileURLToPath } from "url"
import { markdownToBlocks } from "@tryfabric/martian"
import bodyParser from "body-parser"
import cookieParser from "cookie-parser"
import cors from "cors"
import express from "express"
import { fromHtml } from "hast-util-from-html"
import { toMdast } from "hast-util-to-mdast"
import { toMarkdown } from "mdast-util-to-markdown"
import { Stripe } from "stripe"

import { converterHtmlToBlocks, html2blocks } from "./pkgs/html2blocks"

import "dotenv/config"

// Create application/x-www-form-urlencoded parser
const urlencodedParser = bodyParser.urlencoded({ extended: false })

if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PUBLISHABLE_KEY) {
  console.log(
    "The .env file is not configured. Follow the instructions in the readme to configure the .env file. https://github.com/stripe-samples/subscription-use-cases"
  )
  console.log("")
  process.env.STRIPE_SECRET_KEY
    ? ""
    : console.log("Add STRIPE_SECRET_KEY to your .env file.")

  process.env.STRIPE_PUBLISHABLE_KEY
    ? ""
    : console.log("Add STRIPE_PUBLISHABLE_KEY to your .env file.")

  process.exit()
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const app = express()
app.set("view engine", "ejs")
app.set("views", path.join(__dirname, "..", "views"))

app.use(express.static("public"))

// Use cookies to simulate logged in user.
app.use(cookieParser())
app.use(cors())

app.use((req, res, next) => {
  if (req.originalUrl === "/webhook") {
    next()
  } else {
    bodyParser.json()(req, res, next)
  }
})

app.get("/pay/:customer/:theme?", async (req, res) => {
  let PRICING_TABLE_ID = "prctbl_1OrkHRIYBVPkGVmhOUJUtqp7"
  if (req.params.theme == "dark")
    PRICING_TABLE_ID = "prctbl_1Os45vIYBVPkGVmhjfyE7RXf"
  try {
    const customerSession = await stripe.customerSessions.create({
      customer: req.params.customer,
      components: {
        pricing_table: {
          enabled: true
        }
      }
    })
    res.render("pay", {
      PRICING_TABLE_ID,
      CLIENT_SECRET: customerSession.client_secret,
      CUSTOMER_EMAIL: customerSession.customer.email
    })
  } catch (error) {
    return res.status(400).send({ error: { message: error.message } })
  }
})

app.get("/checkout", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "components", "checkout.html"))
})

app.get("/config", async (req, res) => {
  const prices = await stripe.prices.list({
    // lookup_keys: ["sample_basic", "sample_premium"],
    expand: ["data.product"]
  })

  res.send({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    prices: prices.data
  })
})

app.post("/create-customer", async (req, res) => {
  // Create a new customer object
  const customer = await stripe.customers.create({
    email: req.body.email
  })

  res.send({ customer: customer })
})

app.post("/create-payment", async (req, res) => {
  const { userId, email, name } = req.body
  try {
    let customerId = ""
    const customers = await stripe.customers.search({
      query: `metadata['notion-user-id']:'${userId}'`
    })
    if (customers.data?.length) {
      customerId = customers.data[0].id
    } else {
      const customer = await stripe.customers.create({
        name,
        email,
        metadata: { "notion-user-id": userId }
      })
      customerId = customer.id
    }

    res.send({ customerId })
  } catch (error) {
    return res.status(400).send({ error: { message: error.message } })
  }
})

app.post("/create-payment-intent", async (req, res) => {
  const { amount, currency, customerId } = req.body
  try {
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      // In the latest version of the API, specifying the `automatic_payment_methods` parameter is optional because Stripe enables its functionality by default.
      automatic_payment_methods: {
        enabled: true
      }
    })

    res.send({
      clientSecret: paymentIntent.client_secret
    })
  } catch (error) {
    return res.status(400).send({ error: { message: error.message } })
  }
})

app.post("/create-subscription", async (req, res) => {
  // Simulate authenticated user. In practice this will be the
  // Stripe Customer ID related to the authenticated user.
  const customerId = req.body.customerId

  // Create the subscription
  const priceId = req.body.priceId

  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [
        {
          price: priceId
        }
      ],
      payment_behavior: "default_incomplete",
      expand: ["latest_invoice.payment_intent"]
    })

    const latest_invoice = subscription.latest_invoice

    res.send({
      subscriptionId: subscription.id,
      clientSecret: latest_invoice?.payment_intent?.client_secret
    })
  } catch (error) {
    return res.status(400).send({ error: { message: error.message } })
  }
})

app.get("/invoice-preview", async (req, res) => {
  const customerId = req.body.customerId
  const priceId = process.env[req.query.newPriceLookupKey.toUpperCase()]

  const subscription = await stripe.subscriptions.retrieve(
    req.query.subscriptionId
  )

  const invoice = await stripe.invoices.retrieveUpcoming({
    customer: customerId,
    subscription: req.query.subscriptionId,
    subscription_items: [
      {
        id: subscription.items.data[0].id,
        price: priceId
      }
    ]
  })

  res.send({ invoice })
})

app.post("/cancel-subscription", async (req, res) => {
  // Cancel the subscription
  try {
    const deletedSubscription = await stripe.subscriptions.deleteDiscount(
      req.body.subscriptionId
    )

    res.send({ subscription: deletedSubscription })
  } catch (error) {
    return res.status(400).send({ error: { message: error.message } })
  }
})

app.post("/update-subscription", async (req, res) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(
      req.body.subscriptionId
    )
    const updatedSubscription = await stripe.subscriptions.update(
      req.body.subscriptionId,
      {
        items: [
          {
            id: subscription.items.data[0].id,
            price: process.env[req.body.newPriceLookupKey.toUpperCase()]
          }
        ]
      }
    )

    res.send({ subscription: updatedSubscription })
  } catch (error) {
    return res.status(400).send({ error: { message: error.message } })
  }
})

app.get("/subscriptions", async (req, res) => {
  // Simulate authenticated user. In practice this will be the
  // Stripe Customer ID related to the authenticated user.
  const customerId = req.body.customerId

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    expand: ["data.default_payment_method"]
  })

  res.json({ subscriptions })
})

app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    // Retrieve the event by verifying the signature using the raw body and secret.
    let event

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.header("Stripe-Signature"),
        process.env.STRIPE_WEBHOOK_SECRET || ""
      )
    } catch (err) {
      console.log(err)
      console.log(`⚠️  Webhook signature verification failed.`)
      console.log(
        `⚠️  Check the env file and enter the correct webhook secret.`
      )
      return res.sendStatus(400)
    }

    // Extract the object from the event.
    const dataObject = event.data.object

    // Handle the event
    // Review important events for Billing webhooks
    // https://stripe.com/docs/billing/webhooks
    // Remove comment to see the various objects sent for this sample
    switch (event.type) {
      case "invoice.payment_succeeded":
        if (dataObject["billing_reason"] == "subscription_create") {
          // The subscription automatically activates after successful payment
          // Set the payment method used to pay the first invoice
          // as the default payment method for that subscription
          const subscription_id = dataObject["subscription"]
          const payment_intent_id = dataObject["payment_intent"]

          // Retrieve the payment intent used to pay the subscription
          const payment_intent =
            await stripe.paymentIntents.retrieve(payment_intent_id)

          try {
            const subscription = await stripe.subscriptions.update(
              subscription_id,
              {
                default_payment_method: payment_intent.payment_method
              }
            )

            console.log(
              "Default payment method set for subscription:" +
                payment_intent.payment_method
            )
          } catch (err) {
            console.log(err)
            console.log(
              `⚠️  Falied to update the default payment method for subscription: ${subscription_id}`
            )
          }
        }

        break
      case "invoice.payment_failed":
        // If the payment fails or the customer does not have a valid payment method,
        //  an invoice.payment_failed event is sent, the subscription becomes past_due.
        // Use this webhook to notify your user that their payment has
        // failed and to retrieve new card details.
        break
      case "invoice.finalized":
        // If you want to manually send out invoices to your customers
        // or store them locally to reference to avoid hitting Stripe rate limits.
        break
      case "customer.subscription.deleted":
        if (event.request != null) {
          // handle a subscription cancelled by your request
          // from above.
        } else {
          // handle subscription cancelled automatically based
          // upon your subscription settings.
        }
        break
      case "customer.subscription.trial_will_end":
        // Send notification to your user that the trial will end
        break
      default:
      // Unexpected event type
    }
    res.sendStatus(200)
  }
)

app.post("/converter", async (req, res) => {
  const hast = fromHtml(req.body.html, { fragment: true })
  const mdast = toMdast(hast)
  const markdown = toMarkdown(mdast)

  const blocks = markdownToBlocks(markdown)
  return res.send({ ok: true, data: { markdown, blocks } })
})

app.listen(3000, () => console.log("Server ready on port 3000."))

export default app
