// SAMPLE CONTENT, replace with real reviews before launch

export interface ProductReview {
  id: string
  author: string
  rating: number
  verified: boolean
  date: string
  quote: string
}

export const sampleReviews: ProductReview[] = [
  {
    id: "review-1",
    author: "Samantha D.",
    rating: 5,
    verified: true,
    date: "August 14, 2023",
    quote:
      "I absolutely love this product! The design is clean, the material feels premium, and it fits into my daily routine effortlessly. Definitely worth every penny.",
  },
  {
    id: "review-2",
    author: "Alex M.",
    rating: 5,
    verified: true,
    date: "August 15, 2023",
    quote:
      "Exceeded my expectations in every way. The build quality is exceptional and the finishing is super smooth. Shipping was remarkably fast too.",
  },
  {
    id: "review-3",
    author: "Ethan R.",
    rating: 4.5,
    verified: true,
    date: "August 16, 2023",
    quote:
      "Solid purchase. The comfort and utility are exactly what I was hoping for. Packaging was spotless and setup took less than a minute.",
  },
  {
    id: "review-4",
    author: "Olivia P.",
    rating: 5,
    verified: true,
    date: "August 17, 2023",
    quote:
      "Can't say enough good things! I've been using it for a couple of weeks now and it still looks and feels brand new. Highly recommended!",
  },
  {
    id: "review-5",
    author: "Liam K.",
    rating: 4,
    verified: true,
    date: "August 18, 2023",
    quote:
      "Very happy with this item. Beautiful minimalist aesthetic and practical functionality. Will be ordering another one for a friend.",
  },
  {
    id: "review-6",
    author: "Ava H.",
    rating: 5,
    verified: true,
    date: "August 19, 2023",
    quote:
      "PayPilot AI recommended this based on my preferences and it was spot on. Seamless checkout, zero complaints, 10/10 experience.",
  },
  {
    id: "review-7",
    author: "Noah W.",
    rating: 5,
    verified: true,
    date: "August 20, 2023",
    quote:
      "Impressed by the attention to detail. Everything from the materials to the packaging shows thoughtful craftsmanship.",
  },
  {
    id: "review-8",
    author: "Mia T.",
    rating: 4.5,
    verified: true,
    date: "August 21, 2023",
    quote:
      "Modern, durable, and practical. Looks even better in person than in the photos. Would definitely recommend to anyone considering it.",
  },
]

