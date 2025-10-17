import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const prisma = new PrismaClient();

export const ReviewsController = {
  // 📄 Danh sách review
  async list(req: Request, res: Response) {
    try {
      const reviews = await prisma.product_reviews.findMany({
        include: {
          order_items: {
            include: {
              products: {
                select: {
                  title: true,
                  thumbnail: true,
                },
              },
            },
          },
          review_replies: true,
        },
        orderBy: { created_at: "desc" },
      });

      const formatted = reviews.map((r) => ({
        id: r.id,
        productTitle: r.order_items?.products?.title || "Sản phẩm không xác định",
        thumbnail:
          r.order_items?.products?.thumbnail || "/img/default-product.jpg",
        customerName: r.token_user || "Người dùng ẩn danh",
        rating: r.rating,
        content: r.content,
        replyCount: r.review_replies?.length || 0,
        createdAt: r.created_at,
      }));

      res.render("admin/pages/reviews/list", { title: "Reviews List", active: "reviews", reviews: formatted });
    } catch (err) {
      console.error(err);
      res.status(500).send("Lỗi khi tải danh sách đánh giá");
    }
  },

  // 🔍 Chi tiết review
  async detail(req: Request, res: Response) {
    try {
      const id = req.params.id;
      const review = await prisma.product_reviews.findUnique({
        where: { id },
        include: {
          order_items: {
            include: {
              products: {
                select: {
                  title: true,
                  thumbnail: true,
                  price: true,
                },
              },
            },
          },
          review_replies: true,
        },
      });

      if (!review) return res.status(404).send("Không tìm thấy đánh giá.");

      const viewModel = {
        id: review.id,
        productTitle: review.order_items?.products?.title || "Không xác định",
        thumbnail:
          review.order_items?.products?.thumbnail || "/img/default-product.jpg",
        rating: review.rating,
        content: review.content,
        replies: review.review_replies || [],
        createdAt: review.created_at,
      };

      res.render("admin/pages/reviews/detail", { title: "Reviews Detail", active: "reviews", review: viewModel });
    } catch (err) {
      console.error(err);
      res.status(500).send("Lỗi khi tải chi tiết đánh giá");
    }
  },

  // 💬 Gửi phản hồi
  async reply(req: Request, res: Response) {
    try {
      const { reviewId, content } = req.body;

      if (!reviewId || !content.trim()) {
        return res.status(400).send("Thiếu nội dung phản hồi");
      }

      await prisma.review_replies.create({
        data: {
          review_id: reviewId,
          author: "admin",
          content,
        },
      });

      res.redirect(`/admin/reviews/${reviewId}/detail`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Không thể gửi phản hồi");
    }
  },
};
