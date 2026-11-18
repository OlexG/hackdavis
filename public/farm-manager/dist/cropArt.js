const visuals = {
    generic: { shape: "sprout", leaf: "#84b656", produce: "#84b656" },
    leafy: { shape: "rosette", leaf: "#a5cb64", produce: "#a5cb64" },
    herb: { shape: "herb", leaf: "#66b579", produce: "#66b579" },
    grain: { shape: "grain", leaf: "#8ba74d", produce: "#e7bf5e" },
    root: { shape: "taper", leaf: "#80ae57", produce: "#e58f46" },
    mound: { shape: "tuber", leaf: "#709b52", produce: "#c59866" },
    vine: { shape: "vine", leaf: "#72a853", produce: "#e6a447" },
    groundcover: { shape: "berry", leaf: "#79ae59", produce: "#dc595a" },
    fruiting: { shape: "fruit", leaf: "#78a751", produce: "#e35c50" },
};
// Related crops share silhouettes. Color distinguishes varieties within a family.
const variants = [
    [/corn/, "corn", "#8aaa4d", "#f0ca5a"],
    [/wheatgrass|lemongrass|lemon grass|chives?|leeks?|scallions?/, "grass", "#8db658", "#b8cf76"],
    [/sunflowers?|chamomile/, "flower", "#77a956", "#edc34f"],
    [/lavender/, "flower", "#8eb78b", "#b692d8"],
    [/broccoli|brussels sprouts/, "crown", "#85ae60", "#487d49"],
    [/cauliflower/, "crown", "#79a15b", "#f0e6bd"],
    [/radicchio|red cabbage/, "rosette", "#bc7295", "#bc7295"],
    [/spinach|kale|chard|collards?/, "rosette", "#6ab070", "#6ab070"],
    [/carrots?/, "taper", "#80ae57", "#ec9347"],
    [/parsnips?|burdock|horseradish/, "taper", "#85ac5e", "#ead7a6"],
    [/beets?|radishes?/, "bulb", "#88b667", "#cf6786"],
    [/turnips?|rutabagas?/, "bulb", "#88b667", "#c8a0be"],
    [/onions?|garlic|shallots?/, "bulb", "#89b45e", "#f0d8a6"],
    [/potato|ginger/, "tuber", "#7eae61", "#bf9365"],
    [/beans?|peas?|cucumbers?|okra|zucchini|summer squash|squash summer/, "pod", "#76ae60", "#b7c85c"],
    [/watermelons?/, "vine", "#75b369", "#a3c870"],
    [/pumpkins?|melons?|squash/, "vine", "#7aad59", "#ef9e4f"],
    [/blueberr|blackberr|grapes?/, "berry", "#84b56d", "#8e81c4"],
    [/strawberr|raspberr/, "berry", "#87b762", "#ee6a73"],
    [/eggplants?/, "pepper", "#7eac59", "#9e79c2"],
    [/peppers?/, "pepper", "#7eac59", "#ec6654"],
    [/tomato/, "fruit", "#8bb258", "#ed6559"],
    [/apples?|cherries|pomegranates?/, "orchard", "#80ad56", "#ed6a61"],
    [/apricots?|peach|orange|tangerine|grapefruit|persimmons?|mango/, "orchard", "#81ad57", "#efaa5a"],
    [/lemons?|limes?|quince|pears?/, "orchard", "#82b45c", "#e9cc59"],
    [/figs?|plums?/, "orchard", "#80ad57", "#b284bc"],
    [/avocados?|olives?|almonds?|walnuts?|pistachios?/, "orchard", "#77a958", "#c1bf73"],
];
export function cropArtFor(attrs) {
    const name = `${attrs.cropKey ?? ""} ${attrs.cropName ?? ""}`.toLowerCase().replace(/[-_]/g, " ");
    for (const [pattern, shape, leaf, produce] of variants) {
        if (pattern.test(name))
            return { shape, leaf, produce };
    }
    return visuals[attrs.visual] ?? visuals.generic;
}
export function drawCropArt(ctx, art, growth) {
    const { shape, leaf, produce } = art;
    const ripe = growth > 0.48;
    const stem = "#4f7b47";
    function oval(x, y, rx, ry, color, angle = 0) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
        ctx.fill();
    }
    function stalk(x, height) {
        ctx.fillStyle = stem;
        ctx.fillRect(x - 0.65, -height, 1.3, height);
    }
    function leaves(x, y, size = 1) {
        oval(x - 2.2 * size, y - size, 3.4 * size, 1.65 * size, leaf, 0.54);
        oval(x + 2.2 * size, y - 2 * size, 3.4 * size, 1.65 * size, leaf, -0.58);
    }
    ctx.save();
    const scale = 0.58 + 0.42 * growth;
    ctx.scale(scale, scale);
    switch (shape) {
        case "sprout":
            stalk(0, 6);
            leaves(0, -5, 0.73);
            break;
        case "rosette":
            leaves(0, -2, 1.3);
            oval(0, -5, 2.7, 4.2, leaf);
            break;
        case "herb":
            stalk(-2, 11);
            stalk(2.5, 8);
            leaves(-2, -9, 0.8);
            leaves(2.5, -6, 0.76);
            break;
        case "grass":
            oval(-2.7, -5.8, 1.35, 6.3, leaf, -0.41);
            oval(0.3, -6.6, 1.4, 7, produce, 0.13);
            oval(3, -5, 1.25, 5.4, leaf, 0.5);
            break;
        case "grain":
        case "corn":
            stalk(-2.8, 13);
            stalk(3, 10.5);
            leaves(0, -5, 0.84);
            oval(-2.8, -12, shape === "corn" ? 2.25 : 1.45, 3.6, ripe ? produce : leaf, -0.15);
            oval(3, -10, 1.6, 2.9, ripe ? produce : leaf, 0.18);
            break;
        case "flower":
            stalk(0, 12);
            leaves(0, -4, 0.83);
            if (ripe) {
                oval(-2.1, -12, 2.5, 2.5, produce);
                oval(2.1, -12, 2.5, 2.5, produce);
                oval(0, -14, 2.6, 2.5, produce);
                oval(0, -10, 2.6, 2.5, produce);
                oval(0, -12, 1.65, 1.65, "#997348");
            }
            break;
        case "crown":
            stalk(0, 8.5);
            leaves(0, -3);
            if (ripe) {
                oval(-2.6, -8, 2.6, 2.65, produce);
                oval(2.6, -8, 2.6, 2.65, produce);
                oval(0, -10, 3.1, 3, produce);
            }
            break;
        case "taper":
        case "bulb":
            leaves(0, -2);
            if (shape === "bulb") {
                oval(0, -0.2, 3.1, 2.8, produce);
            }
            else {
                ctx.fillStyle = produce;
                ctx.beginPath();
                ctx.moveTo(-2.8, -1.5);
                ctx.quadraticCurveTo(0, -2.8, 2.8, -1.5);
                ctx.lineTo(-0.5, 4);
                ctx.closePath();
                ctx.fill();
            }
            break;
        case "tuber":
            leaves(-2, -2);
            leaves(2.5, -4, 0.83);
            if (ripe) {
                oval(-1.6, 0.2, 2.7, 1.9, produce, -0.3);
                oval(3.3, 0.6, 2.2, 1.6, produce, 0.18);
            }
            break;
        case "vine":
        case "pod":
            leaves(-3.6, -2, 0.9);
            leaves(2.4, -3, 0.74);
            if (ripe) {
                const pod = shape === "pod";
                oval(4.1, -0.8, pod ? 4.3 : 3.7, pod ? 1.65 : 3.05, produce, pod ? -0.34 : 0);
            }
            break;
        case "berry":
            leaves(0, -3, 1.14);
            if (ripe) {
                oval(-2.2, -1, 1.8, 1.8, produce);
                oval(2.7, -0.4, 1.8, 2.1, produce);
            }
            break;
        case "fruit":
        case "pepper":
            stalk(0, 12);
            leaves(0, -10);
            if (ripe) {
                const pepper = shape === "pepper";
                oval(-3.2, -6.2, pepper ? 1.75 : 2.65, pepper ? 3.25 : 2.55, produce, pepper ? -0.34 : 0);
                oval(3.2, -7.7, 2.05, 2.45, produce);
            }
            break;
        case "orchard":
            stalk(0, 12);
            oval(-3, -10, 4.15, 4.25, leaf);
            oval(2.8, -11, 4.4, 4.65, leaf);
            if (ripe) {
                oval(-3.8, -10.2, 1.55, 1.55, produce);
                oval(2.2, -12.6, 1.55, 1.55, produce);
                oval(4.6, -8.7, 1.55, 1.55, produce);
            }
            break;
    }
    ctx.restore();
}
//# sourceMappingURL=cropArt.js.map