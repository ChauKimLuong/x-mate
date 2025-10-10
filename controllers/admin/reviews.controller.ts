import { Request, Response } from "express";

export const getReviewsList = (_req: Request, res: Response) => {
  const reviews = [
    {
      country: "U.S.A",
      date: "21 December 2023",
      content:
        "I recently purchased a t-shirt that I was quite excited about...",
      stars: 5,
      quality: "Excellent Quality",
      avatar: "https://i.pravatar.cc/100?img=11",
      user: "Michael B. Coch",
      title: "Kaika Hill, CEO / Hill & CO",
    },
    {
      country: "Canada",
      date: "16 March 2023",
      content:
        "I purchased a pair of jeans. The fabric is fantastic—it's durable...",
      stars: 5,
      quality: "Best Quality",
      avatar: "https://i.pravatar.cc/100?img=12",
      user: "Theresa T. Brose",
      title: "Millenia Life / General internist",
    },
    {
      country: "Germany",
      date: "23 October 2023",
      content:
        "The fit is perfect, hugging in all the right places while allowing ease of movement...",
      stars: 4,
      quality: "Good Quality",
      avatar: "https://i.pravatar.cc/100?img=13",
      user: "James L. Erickson",
      title: "Omni Tech Solutions / Founder",
    },
    {
      country: "Germany",
      date: "23 October 2023",
      content:
        "The fit is perfect, hugging in all the right places while allowing ease of movement...",
      stars: 4,
      quality: "Good Quality",
      avatar: "https://i.pravatar.cc/100?img=14",
      user: "Lily W. Wilson",
      title: "Grade A Investment / Manager",
    },
    {
      country: "Canada",
      date: "29 May 2023",
      content:
        "Additionally, the fit is perfect, providing great support and comfort...",
      stars: 5,
      quality: "Excellent Quality",
      avatar: "https://i.pravatar.cc/100?img=15",
      user: "Sarah M. Brooks",
      title: "Northland / Customer",
    },
    {
      country: "Iceland",
      date: "12 May 2023",
      content:
        "I ordered my usual size, but the shoes are either too small or too big...",
      stars: 3,
      quality: "Bad Quality",
      avatar: "https://i.pravatar.cc/100?img=16",
      user: "Jennifer Schafer",
      title: "Freelancer",
    },
  ];

  res.render("admin/pages/reviews/list", {
    title: "Reviews List",
    reviews,
  });
};
