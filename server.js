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

// ========================================
// 投稿一覧取得 API
// ========================================
// GET /api/posts にアクセスしたときの処理

app.get("/api/posts", async (req, res) => {
  // async = この関数の中で await を使えるようにする
  try {
    // try-catch = エラーが起きても安全に処理する

    const posts = await prisma.post.findMany({
      // prisma.post = Post テーブルを操作
      // findMany() = 複数のデータを取得
      orderBy: { createdAt: "desc" },
      // orderBy = 並び順を指定
      // createdAt: "desc" = 作成日時の降順（新しい順）
    });

    res.json(posts);
    // → 取得したデータをJSON形式で返す

  } catch (error) {
    // エラーが発生した場合

    console.error("Error fetching posts:", error);
    // → エラーログを出力（デバッグ用）

    res.status(500).json({ error: "投稿の取得に失敗しました" });
    // → 500 = サーバーエラー
    // → エラーメッセージを返す
  }
});

// ========================================
// 投稿作成 API
// ========================================
// POST /api/posts にアクセスしたときの処理

// ここからAPIを開発する流れをイメージしてもらいます🤗
app.post("/api/posts", async (req, res) => {
  try {
    // ここで送られたデータを受け取ります
    const { content, imageUrl, userId } = req.body;
    // req.body = データの塊でAPIでデータが送られる場所になっています🤗そこから分割代入というjsのテクニックを使って抜き出しています🤗

    // バリデーションのチェックをします！本当に送られてるの？？大丈夫？？ってものです🤗

    if (!content || content.trim() === "") {
      // エラーを通知させます！そしてその結果をresponseとして返却しています🤗
      return res.status(400).json({
        error: "投稿の中身が空なので入力してください",
      });
    }

    // 登録の処理の場所です🤗prismaを使ってデータを実際に登録するフェースです🤗
    const post = await prisma.post.create({
      // prismaの公式のお作法になっています🤗難しく考えないでください🤗
      data: {
        content: content.trim(),
        imageUrl: imageUrl || null,
        userId: userId || null,
      },
    });

    // この形式をDBに登録した後に成功したという結果をstatusでお知らせとデータを戻してくれる🤗
    res.status(201).json(post);
  } catch (error) {
    // エラーの書き方は変わりませんのでテンプレと思ってください🤗
    console.error("Error creating post:", error);
    res.status(500).json({ error: "投稿の作成に失敗しました" });
  }

  // この下は消さない
});

// ========================================
// 投稿削除 API
// ========================================
// DELETE /api/posts/:id にアクセスしたときの処理
// :id = パスパラメータ（URL の一部として ID を受け取る）

app.delete("/api/posts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // req.params = URL のパスパラメータ
    // req.params.id = :id の部分の値
    // parseInt() = 文字列を整数に変換（"1" → 1）

    if (isNaN(id)) {
      // isNaN() = 数字でないかチェック
      return res.status(400).json({ error: "無効なIDです" });
    }

    await prisma.post.delete({
      // prisma.post.delete() = データを削除
      where: { id },
      // where = 条件を指定
      // { id } = { id: id } の省略形（ES6）
    });

    res.json({ message: "投稿を削除しました" });

  } catch (error) {
    console.error("Error deleting post:", error);

    if (error.code === "P2025") {
      // P2025 = Prisma のエラーコード（レコードが見つからない）
      return res.status(404).json({ error: "投稿が見つかりません" });
      // → 404 = Not Found
    }

    res.status(500).json({ error: "投稿の削除に失敗しました" });
  }
});

// ========================================
// サーバー起動
// ========================================

// ここでサーバーを起動させます。listenがないと動きません！これでアクセスをしたらサーバーが動きます。必ず一番下に書く！
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});