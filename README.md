# LASER SLICER RUSH

ブラウザ向け60秒連鎖パズル。前の切断プロトタイプを、盤面補充・コンボ・ボム連爆・フィーバーを中心としたゲームに変更しました。

## 遊び方

- 同じ色を縦・横・斜めに3個以上なぞって離すと消去。同色のかたまりはタップでも消せます。
- 7個以上をまとめて消すとボムが残ります。ボムのタップで周囲3×3を爆破し、巻き込まれたボムも連爆します。
- 消した場所に上から新しいブロックが補充されます。
- 3.5秒以内の連続消去でコンボ倍率が上昇。大きなかたまりほど得点が増えます。
- 消去でゲージを満たすと10秒間のフィーバー。スコア3倍・コンボ維持・残り時間＋5秒（最大65秒）。
- 基本制限時間60秒。残り10秒で警告色に変化。シャッフルは2回、消せる場所がなくなれば無料で自動シャッフル。
- Esc／Ⅱで一時停止。非表示タブでは自動停止。最高点と音設定はブラウザに保存します。
- 粒子と振動はOSの「視差効果を減らす」設定を尊重します。振動は対応端末のみ。

## 開発

Node.js 22.12以降（本環境24.19）。

```sh
npm ci --cache /tmp/laser-npm-cache
npm run dev
npm test
npm run test:e2e
npm run build
node tests/pages-smoke.mjs
```

`src/arcade.js` が盤面・隣接・補充・得点ルール、`src/main.js` がゲームと描画、`src/style.css` がUIです。旧プロトタイプの幾何計算・ステージ・物理テストは比較用に残していますが、現在のゲームからは使用しません。

E2Eは `/usr/bin/chromium` があれば利用し、それ以外では `npx playwright install chromium` が必要です。実機Safari／Androidでの性能・操作感、得点と制限時間のバランスは引き続きプレイテスト対象です。広告・課金・外部分析はありません。

## GitHub Pages

`main` へのpushで `.github/workflows/pages.yml` がテスト・ビルド・公開します。初回のみ Settings → Pages → Source を GitHub Actions に設定してください。失敗した場合はActionsで実行結果を確認できます。

公開先：https://sirosirokumamamm-netizen.github.io/inoshishi-dash/
