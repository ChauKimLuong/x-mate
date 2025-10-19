import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class OrdersController {
  /**
   * [GET] /admin/orders
   * Hiển thị danh sách đơn hàng với 3 trạng thái: pending, confirmed, cancelled
   */
  static async list(req: Request, res: Response) {
    try {
        const orders = await prisma.orders.findMany({
      orderBy: { created_at: "desc" },
      include: {
        order_items: {
          take: 1, // lấy 1 sản phẩm đầu tiên trong đơn
          include: {
            products: {
              select: { thumbnail: true }, // chỉ lấy ảnh
            },
          },
        },
      },
    });


      const viewOrders = orders.map((o) => ({
        id: o.id,
        customerName: o.shipping_full_name,
        total: Number(o.grand_total || 0),
        status: o.status,
        thumbnail: o.order_items?.[0]?.products?.thumbnail || null
      }));

      res.render("admin/pages/orders/list", { title: "Order", active: "orders", orders: viewOrders });
    } catch (error) {
      console.error("Lỗi khi tải danh sách đơn hàng:", error);
      res.status(500).send("Không thể tải danh sách đơn hàng");
    }
  }

  /**
   * [GET] /admin/orders/:id/detail
   * Hiển thị chi tiết đơn hàng
   */
  static async detail(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const order = await prisma.orders.findUnique({
        where: { id },
        include: {
          order_items: {
            include: { products: true, productVariants: true },
          },
        },
      });

      if (!order) return res.status(404).send("Không tìm thấy đơn hàng");

      res.render("admin/pages/orders/detail", { title: "Order", active: "orders", order });
    } catch (error) {
      console.error("Lỗi khi xem chi tiết đơn hàng:", error);
      res.status(500).send("Không thể tải chi tiết đơn hàng");
    }
  }

  /**
   * [POST] /admin/orders/:id/confirm
   * Xác nhận đơn hàng -> đổi trạng thái sang "confirmed"
   * Đồng thời trừ tồn kho trong inventoryMovements
   */
  static async confirm(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const order = await prisma.orders.findUnique({ where: { id } });
      if (!order) return res.status(404).send("Không tìm thấy đơn hàng");

      if (order.status !== "pending") {
        return res.status(400).send("Đơn hàng không ở trạng thái chờ xác nhận");
      }

      // Cập nhật trạng thái đơn
      await prisma.orders.update({
        where: { id },
        data: { status: "completed", updated_at: new Date() },
      });

      // Trừ tồn kho
      const items = await prisma.order_items.findMany({ where: { order_id: id } });
      for (const item of items) {
        await prisma.inventoryMovements.create({
          data: {
            productId: item.product_id,
            variantId: item.variant_id,
            delta: -item.quantity,
            reason: "orderPlaced",
            refOrderId: id,
          },
        });
      }

      res.redirect("/admin/orders");
    } catch (error) {
      console.error("Lỗi khi xác nhận đơn hàng:", error);
      res.status(500).send("Không thể xác nhận đơn hàng");
    }
  }

  /**
   * [POST] /admin/orders/:id/cancel
   * Hủy đơn hàng -> đổi trạng thái sang "cancelled"
   */
  static async cancel(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const order = await prisma.orders.findUnique({ where: { id } });
      if (!order) return res.status(404).send("Không tìm thấy đơn hàng");

      if (order.status !== "pending") {
        return res.status(400).send("Chỉ có thể hủy đơn hàng đang chờ xác nhận");
      }

      await prisma.orders.update({
        where: { id },
        data: { status: "cancelled", updated_at: new Date() },
      });

      res.redirect("/admin/orders");
    } catch (error) {
      console.error("Lỗi khi hủy đơn hàng:", error);
      res.status(500).send("Không thể hủy đơn hàng");
    }
  }
}
