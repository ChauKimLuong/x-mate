"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewsController = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.ReviewsController = {
    list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const reviews = yield prisma.product_reviews.findMany({
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
                const formatted = reviews.map((r) => {
                    var _a, _b, _c, _d, _e;
                    return ({
                        id: r.id,
                        productTitle: ((_b = (_a = r.order_items) === null || _a === void 0 ? void 0 : _a.products) === null || _b === void 0 ? void 0 : _b.title) || "Sản phẩm không xác định",
                        thumbnail: ((_d = (_c = r.order_items) === null || _c === void 0 ? void 0 : _c.products) === null || _d === void 0 ? void 0 : _d.thumbnail) || "/img/default-product.jpg",
                        customerName: r.token_user || "Người dùng ẩn danh",
                        rating: r.rating,
                        content: r.content,
                        replyCount: ((_e = r.review_replies) === null || _e === void 0 ? void 0 : _e.length) || 0,
                        createdAt: r.created_at,
                    });
                });
                res.render("admin/pages/reviews/list", { title: "Reviews List", active: "reviews", reviews: formatted });
            }
            catch (err) {
                console.error(err);
                res.status(500).send("Lỗi khi tải danh sách đánh giá");
            }
        });
    },
    detail(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            try {
                const id = req.params.id;
                const review = yield prisma.product_reviews.findUnique({
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
                if (!review)
                    return res.status(404).send("Không tìm thấy đánh giá.");
                const viewModel = {
                    id: review.id,
                    productTitle: ((_b = (_a = review.order_items) === null || _a === void 0 ? void 0 : _a.products) === null || _b === void 0 ? void 0 : _b.title) || "Không xác định",
                    thumbnail: ((_d = (_c = review.order_items) === null || _c === void 0 ? void 0 : _c.products) === null || _d === void 0 ? void 0 : _d.thumbnail) || "/img/default-product.jpg",
                    rating: review.rating,
                    content: review.content,
                    replies: review.review_replies || [],
                    createdAt: review.created_at,
                };
                res.render("admin/pages/reviews/detail", { title: "Reviews Detail", active: "reviews", review: viewModel });
            }
            catch (err) {
                console.error(err);
                res.status(500).send("Lỗi khi tải chi tiết đánh giá");
            }
        });
    },
    reply(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { reviewId, content } = req.body;
                if (!reviewId || !content.trim()) {
                    return res.status(400).send("Thiếu nội dung phản hồi");
                }
                yield prisma.review_replies.create({
                    data: {
                        review_id: reviewId,
                        author: "admin",
                        content,
                    },
                });
                res.redirect(`/admin/reviews/${reviewId}/detail`);
            }
            catch (err) {
                console.error(err);
                res.status(500).send("Không thể gửi phản hồi");
            }
        });
    },
};
