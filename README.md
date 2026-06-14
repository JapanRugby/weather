# Hourly Weather PDF / 時間別天気PDF

地域を検索し、06:00〜20:00の時間別予報を英日併記の固定レイアウトで表示し、A4横1ページのPDFとして保存できるGitHub Pages向けサイトです。

![PDF layout preview](preview.png)


## 主な機能

- 初期表示は宮崎市
- 世界中の地名、市区町村、郵便番号を検索
- 06:00〜20:00の15時間を固定表示
- 天気、気温、降水確率、風向、風速を英日併記
- 気温と風速のグラフ
- 同一テンプレートによるA4横1ページPDF
- お気に入り地域をブラウザに保存
- URL共有
- 15分ごとの自動再取得
- 自動モード：現地時刻18:00以降は翌日、それ以前は当日
- GitHub ActionsによるPages公開
- GitHub Actionsによる定時PDF生成（初期値は宮崎市）

## データソース

- 地域検索：Open-Meteo Geocoding API
- 天気予報：Open-Meteo Forecast API

APIキーは不要です。利用条件とクレジット表記はOpen-Meteoの最新規約を確認してください。

## GitHub Pagesへの公開

1. このフォルダの内容を新しいGitHubリポジトリへ追加します。
2. 既定ブランチ名を `main` にします。
3. GitHubの **Settings → Pages → Build and deployment → Source** を **GitHub Actions** に設定します。
4. `main` にpushすると `.github/workflows/pages.yml` が実行されます。
5. Actionsのデプロイ完了後、PagesのURLを開きます。

## ローカル実行

```bash
npm install
npm start
```

ブラウザで `http://127.0.0.1:4173` を開きます。

単純な静的サイトなので、Pythonでも確認できます。

```bash
python3 -m http.server 4173
```

## PDF保存

サイトの **PDF Save / PDF保存** を押し、ブラウザの印刷画面で「PDFに保存」を選びます。

推奨設定：

- 用紙：A4
- 向き：横
- 余白：なし、または既定
- 背景グラフィック：オン
- 拡大縮小：100%

印刷用CSSでレイアウト、配色、サマリーカード、グラフ、15枚の時間別カード、フッターを固定しています。

## ActionsでPDFを生成

`Generate Weather PDF` ワークフローは次の時刻に実行されます。

- 06:00 JST
- 12:00 JST
- 18:00 JST

自動モードでは、18:00以降は翌日の06:00〜20:00、それ以前は当日の06:00〜20:00を生成します。

手動実行では、地域名、緯度、経度、タイムゾーン、対象日モードを入力できます。生成されたPDFはGitHub ActionsのArtifactから取得できます。

初回のみローカルで次を実行し、`package-lock.json`をコミットしてください。

```bash
npm install
```

## 初期地域の変更

`app.js` の `CONFIG.defaultLocation` を編集します。

```js
const CONFIG = {
  defaultLocation: {
    name: "Miyazaki",
    nameJa: "宮崎市",
    latitude: 31.9077,
    longitude: 131.4202,
    timezone: "Asia/Tokyo"
  }
};
```

定時PDFの初期地域は `.github/workflows/generate-pdf.yml` の既定値も変更してください。

## URLパラメータ

選択地点はURLに保存されるため、そのまま共有できます。

```text
?lat=35.6762&lon=139.6503&name=Tokyo&nameJa=東京都&timezone=Asia/Tokyo&mode=auto
```

`mode` は `auto`、`today`、`tomorrow` のいずれかです。

## 注意事項

- 予報は気象モデルに基づくため、更新のたびに変わる場合があります。
- 「Issued at / 発表時刻」はAPI取得時刻として表示しています。
- GitHub Pagesは静的ホスティングのため、利用者が検索した地域をサーバー側の定時登録へ自動追加する機能はありません。
- 利用者は任意地域を検索し、その場で最新予報を表示・PDF保存できます。
