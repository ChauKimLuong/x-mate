import { Request, Response } from "express";

export const OrdersController = {
  // 🧾 Danh sách đơn hàng
  list: (_req: Request, res: Response) => {
    const mockOrders = [
      { id: 1, customer: "Nguyễn Văn A", total: 250000, status: "Chờ duyệt" },
      { id: 2, customer: "Lê Thị B", total: 180000, status: "Đã duyệt" },
      { id: 3, customer: "Phạm Quốc Cường", total: 300000, status: "Yêu cầu hủy" },
    ];

    res.render("admin/pages/orders/list", {
      title: "Order",
      active: "orders",
      orders: mockOrders,
    });
  },

  // 👀 Chi tiết đơn hàng
  detail: (req: Request, res: Response) => {
    const mockOrder = {
      id: req.params.id,
      customer: "Nguyễn Văn A",
      total: 250000,
      date: "10/10/2025",
      address: "123 Lý Thường Kiệt, TP.HCM",
      items: [
        { name: "Trà sữa khoai môn", qty: 2, price: 50000 },
        { name: "Trà đào cam sả", qty: 1, price: 70000 },
      ],
    };

    res.render("admin/pages/orders/detail", {
      title: "Order",
      active: "orders",
      order: mockOrder,
    });
  },

  // ⚠️ Trang yêu cầu hủy đơn hàng
  request: (req: Request, res: Response) => {
    const mockOrder = {
      id: req.params.id,
      customer: "Nguyễn Văn A",
      total: 250000,
    };

    res.render("admin/pages/orders/request", {
      title: "Order",
      active: "orders",
      order: mockOrder,
    });
  },
};
