<h1><p align="center"><img src="./ai.svg" alt="藍" height="200"></p></h1>
<p align="center">An Ai for Misskey. <a href="./torisetu.md">About Ai</a></p>

## これなに
Misskey用の日本語Botです。

## インストール
> Node.js と npm と MeCab (オプション) がインストールされている必要があります。

まず適当なディレクトリに `git clone` します。
次にそのディレクトリに `config.json` を作成します。`example.json` をコピーして編集しても構いません。

### config.json の例
`config.json` にはアプリ共通の設定を置き、モジュールごとの詳細設定は `modulesConfig` に入れます。
また、AI のプロンプト本文は `prompt.txt` に置きます。

```json
{
  "host": "https://misskey.example.com",
  "i": "_YOUR_BOT_TOKEN",
  "master": "BOT_MASTER_NAME",
  "mecab": "/usr/bin/mecab",
  "mecabDic": "/usr/lib/x86_64-linux-gnu/mecab/dic/mecab-ipadic-neologd/",
  "memoryDir": "data",
  "modules": [
    "aichat",
    "reminder",
    "talk",
    "welcome",
    "reversi"
  ],
  "modulesConfig": {
    "aichat": {
      "randomTalkEnabled": true,
      "randomTalkProbability": 0.01,
      "randomTalkIntervalMinutes": 720,
      "groundingWithGoogleSearchAlwaysEnabled": false
    }
  },
  "api": {
    "provider": "openai",
    "baseUrl": "http://localhost:8080/v1/chat/completions",
    "apiKey": "",
    "model": "qwen2.5:7b"
  }
}
```

`prompt.txt` には AI の応答方針をそのまま書きます。

```text
返答のルール:あなたはMisskey看板娘の女の子AI、三須木(みすき)藍として振る舞ってください...
```

### モジュール一覧
`modules` に入れるモジュール名と、その役割の概要です。

| モジュール | 説明 |
| --- | --- |
| aichat | AIチャット応答とメンション対応を担当します。 |
| reminder | リマインダーや予定通知を管理します。 |
| talk | 日常会話や雑談系の応答を担当します。 |
| check-custom-emojis | カスタム絵文字の追加や変更を検知します。 |
| emoji | 絵文字の投稿や生成を担当します。 |
| emoji-react | 絵文字へのリアクション処理を担当します。 |
| fortune | 占い機能を提供します。 |
| guessing-game | 当てっこゲームを実行します。 |
| kazutori | かずとりゲームを提供します。 |
| reversi | オセロ・リバーシゲームを提供します。 |
| timer | タイマー機能を提供します。 |
| dice | サイコロ機能を提供します。 |
| ping | 「生きているか」のヘルスチェック的な応答を提供します。 |
| welcome | 新規参加者の挨拶や歓迎メッセージを担当します。 |
| server | サーバー監視や状態確認を行います。 |
| follow | フォロー/フォロワーの監視や自動対応を担当します。 |
| valentine | バレンタイン関連の通知やイベント対応をします。 |
| birthday | 誕生日の通知やイベント対応をします。 |
| keyword | キーワード学習やキーワードに応じた反応を担当します。 |
| maze | 迷路ゲームを提供します。 |
| chart | チャート作成機能を提供します。 |
| sleep-report | 睡眠や生活ログに関する報告機能を提供します。 |
| noting | ランダムノート投稿や自動投稿を担当します。 |
| poll | 投票機能を提供します。 |

### AIプロバイダの設定
- `api.provider` で既定のAIを `gemini` / `openai` / `plamo` のいずれかに指定できます。
- `api.baseUrl` と `api.model` は必須です。
- `api.apiKey` は OpenAI 互換ローカル環境では空文字でも動作する構成を想定しています。
- メッセージ中に `&openai` / `&gemini` / `&plamo` を含めると、その場だけそのAIを優先して使います。
- `&chatgpt` / `&chatgpt4` も OpenAI 相当として扱われます。
- `@botname` のように bot をメンションすると、`aichat` キーワードがなくても AI が起動します。

### OpenAI互換のLocalAI連携
`api.baseUrl` に互換エンドポイントを設定してください。例:

```json
{
  "api": {
    "provider": "openai",
    "baseUrl": "http://localhost:8080/v1/chat/completions",
    "apiKey": "",
    "model": "qwen2.5:7b"
  }
}
```

`api.apiKey` が空でも動く構成を想定しています。公開済みの OpenAI 互換API を使う場合は、その値を設定してください。

`npm install` して `npm run build` して `npm start` すれば起動できます。

## Dockerで動かす
まず適当なディレクトリに `git clone` します。
次にそのディレクトリに `config.json` を作成します。`example.json` をコピーして編集しても構いません。
（MeCabの設定、`memoryDir` はそのままで問題ありません）

```json
{
  "host": "https://misskey.example.com",
  "i": "_YOUR_BOT_TOKEN",
  "master": "BOT_MASTER_NAME",
  "mecab": "/usr/bin/mecab",
  "mecabDic": "/usr/lib/x86_64-linux-gnu/mecab/dic/mecab-ipadic-neologd/",
  "memoryDir": "data",
  "modules": [
    "aichat",
    "reminder",
    "talk",
    "welcome",
    "reversi"
  ],
  "modulesConfig": {
    "aichat": {
      "randomTalkEnabled": true,
      "randomTalkProbability": 0.01,
      "randomTalkIntervalMinutes": 720,
      "groundingWithGoogleSearchAlwaysEnabled": false
    }
  },
  "api": {
    "provider": "openai",
    "baseUrl": "https://api.openai.com/v1/chat/completions",
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "model": "gpt-4o-mini"
  }
}
```

`docker-compose build` して `docker-compose up` すれば起動できます。
`docker-compose.yml` の `enable_mecab` を `0` にすると、MeCabをインストールしないようにもできます。（メモリが少ない環境など）

## フォント
一部の機能にはフォントが必要です。藍にはフォントは同梱されていないので、ご自身でフォントをインストールディレクトリに`font.ttf`という名前で設置してください。

## 記憶
藍は記憶の保持にインメモリデータベースを使用しており、藍のインストールディレクトリに `memory.json` という名前で永続化されます。

## ライセンス
MIT

## Awards
<img src="./WorksOnMyMachine.png" alt="Works on my machine" height="120">
