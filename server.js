// ========================================
// パッケージの読み込み
// ========================================
// require() = パッケージを読み込む関数
// 他の人が作ったコードを使えるようにする

const express = require("express");
// → Express: Webサーバーを作るフレームワーク
//   app.get(), app.post() などでAPIを定義できる

const cors = require("cors");
// → CORS: 異なるドメイン間の通信を許可
//   Next.js（localhost:3000）からAPI（localhost:8888）にアクセスできるようにする

const { PrismaClient } = require("./generated/prisma");
// → Prisma Client: データベースを操作するためのクラス
//   prisma.post.findMany() などでCRUD操作ができる

// ========================================
// 初期化
// ========================================

const app = express();
// → Express アプリケーションを作成
//   このappにルート（API）を追加していく

const prisma = new PrismaClient();
// → Prisma Client のインスタンスを作成
//   この prisma を使ってDBを操作する

// ========================================
// ミドルウェアの設定
// ========================================
// ミドルウェア = リクエストを処理する前に実行される関数
// 全てのリクエストに対して共通の処理を行う

app.use(cors());
// → CORS を許可
//   これがないと Next.js から API にアクセスできない

app.use(express.json());
// → JSON リクエストを解析
//   req.body でJSONデータを受け取れるようにする

// ========================================
// 環境変数
// ========================================

const PORT = process.env.PORT || 8888;
// → process.env = .env ファイルの値を読み込む
// → || = もし値がなければ右側の値を使う（デフォルト値）

// ========================================
// 動作確認用エンドポイント
// ========================================
// GET / にアクセスしたときの処理

app.get("/",(req, res) =>{
  // req = リクエスト（クライアントからのお願い）
  // res = レスポンス（サーバーからの返事）
  res.send("<h1>おおほりは長野で研究しています</h1>");
});

// server.js に追加

// ========================================
// 投稿一覧取得 API（いいね対応版）
// ========================================
// GET /api/posts
// GET /api/posts?userId=xxx（いいね状態を取得する場合）

app.get("/api/posts", async (req, res) => {
  try {
    // クエリパラメータからユーザーIDを取得（任意）
    const userId = req.query.userId;

    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        // いいねの数を取得
        _count: {
          select: { likes: true },
        },
        // 現在のユーザーがいいねしているかどうか
        likes: userId
          ? {
              where: { userId },
              select: { id: true },
            }
          : false,
      },
    });

    // レスポンス用にデータを整形
    const formattedPosts = posts.map((post) => ({
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl,
      userId: post.userId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      likeCount: post._count.likes,
      isLiked: userId ? post.likes.length > 0 : false,
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "投稿の取得に失敗しました" });
  }
});

// ========================================
// 投稿作成 API
// ========================================
// POST /api/posts

app.post("/api/posts", async (req, res) => {
  try {
    const { content, imageUrl, userId } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "投稿内容を入力してください" });
    }

    const post = await prisma.post.create({
      data: {
        content: content.trim(),
        imageUrl: imageUrl || null,
        userId: userId || null,
      },
    });

    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "投稿の作成に失敗しました" });
  }
});

// ========================================
// 投稿削除 API
// ========================================
// DELETE /api/posts/:id

app.delete("/api/posts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "無効なIDです" });
    }

    await prisma.post.delete({
      where: { id },
    });

    res.json({ message: "投稿を削除しました" });
  } catch (error) {
    console.error("Error deleting post:", error);

    if (error.code === "P2025") {
      return res.status(404).json({ error: "投稿が見つかりません" });
    }

    res.status(500).json({ error: "投稿の削除に失敗しました" });
  }
});

// ========================================
// いいね追加 API【Day3 で追加】
// ========================================
// POST /api/posts/:id/like

app.post("/api/posts/:id/like", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { userId } = req.body;

    // バリデーション
    if (isNaN(postId)) {
      return res.status(400).json({ error: "無効な投稿IDです" });
    }
    if (!userId) {
      return res.status(400).json({ error: "ユーザーIDが必要です" });
    }

    // いいねを作成
    await prisma.like.create({
      data: {
        postId,
        userId,
      },
    });

    // いいね数を取得して返す
    const likeCount = await prisma.like.count({
      where: { postId },
    });

    res.status(201).json({ likeCount, isLiked: true });
  } catch (error) {
    // すでにいいねしている場合
    if (error.code === "P2002") {
      return res.status(400).json({ error: "すでにいいねしています" });
    }
    console.error("Error creating like:", error);
    res.status(500).json({ error: "いいねに失敗しました" });
  }
});

// ========================================
// いいね削除 API【Day3 で追加】
// ========================================
// DELETE /api/posts/:id/like

app.delete("/api/posts/:id/like", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { userId } = req.body;

    // バリデーション
    if (isNaN(postId)) {
      return res.status(400).json({ error: "無効な投稿IDです" });
    }
    if (!userId) {
      return res.status(400).json({ error: "ユーザーIDが必要です" });
    }

    // いいねを削除
    await prisma.like.deleteMany({
      where: {
        postId,
        userId,
      },
    });

    // いいね数を取得して返す
    const likeCount = await prisma.like.count({
      where: { postId },
    });

    res.json({ likeCount, isLiked: false });
  } catch (error) {
    console.error("Error deleting like:", error);
    res.status(500).json({ error: "いいねの削除に失敗しました" });
  }
});

// ========================================
// サーバー起動
// ========================================

// ここでサーバーを起動させます。listenがないと動きません！これでアクセスをしたらサーバーが動きます。必ず一番下に書く！
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});