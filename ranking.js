function calculateVGIndex(wins, games, k = 20) {
    if (games === 0) return 50.00;

    const result = (
        (wins + (k * 0.5)) /
        (games + k)
    ) * 100;

    return Number(result.toFixed(2));
}

module.exports = {
    calculateVGIndex
};
