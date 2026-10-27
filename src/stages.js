const grid = (xs, ys, w, h, colors = ["#c5f56b", "#b5a0ff", "#ffb57b"]) =>
  ys.flatMap((y, row) =>
    xs.map((x, col) => ({
      x,
      y,
      w,
      h,
      color: colors[(row + col) % colors.length],
    })),
  );
export const stages = [
  {
    name: "ファースト・カット",
    subtitle: "すべては、ひと筋の光から。",
    shots: 5,
    threshold: 5800,
    blocks: grid([222, 378], [235, 365, 495], 112, 96),
    hint: "ブロックの真ん中を横にスライス。小さな破片は光に変わる。",
  },
  {
    name: "クロス・セクション",
    subtitle: "交わる軌跡が、答えになる。",
    shots: 8,
    threshold: 3300,
    blocks: grid([165, 300, 435], [265, 400], 112, 104),
    hint: "大きな破片にはもう一度。縦と横の切断を組み合わせよう。",
  },
  {
    name: "ネオン・ステップ",
    subtitle: "角度を変えると、世界が変わる。",
    shots: 7,
    threshold: 5700,
    blocks: [
      ...grid([180], [240], 130, 84),
      ...grid([300], [340], 130, 84),
      ...grid([420], [440], 130, 84),
      ...grid([180, 420], [540], 130, 84),
    ],
    hint: "斜めのレーザーで階段をまとめて切断。",
  },
  {
    name: "シンメトリー",
    subtitle: "美しい一手には、理由がある。",
    shots: 7,
    threshold: 4200,
    blocks: grid([190, 410], [265, 420], 138, 112),
    hint: "中心を見極めて、同じ面積に分けてみよう。",
  },
  {
    name: "パルス・リアクター",
    subtitle: "ためた光を、一気に解き放つ。",
    shots: 9,
    threshold: 3400,
    blocks: grid([165, 300, 435], [230, 355, 480], 106, 100),
    hint: "切断でゲージを蓄積。パルスは次の連鎖ボーナスを2倍に。",
  },
  {
    name: "ラスト・ライト",
    subtitle: "最後の一筋まで、考え抜こう。",
    shots: 10,
    threshold: 3400,
    blocks: grid([155, 300, 445], [235, 375, 515], 118, 110),
    hint: "80%でクリア。すべてを消す必要はない。狙いを絞ろう。",
  },
];
