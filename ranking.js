function calculateVGIndex(wins, games, k = 20, winWeight = 0.5) {
    if (games === 0) return 50.00;

    // winWeight substitui o 0.5 fixo da fórmula original
    // Se winWeight > 0.5, a vitória vale mais e a derrota tira menos
    // Se winWeight < 0.5, a vitória vale menos e a derrota tira mais
    const result = (
        (wins + (k * winWeight)) /
        (games + k)
    ) * 100;

    return Number(result.toFixed(2));
}

module.exports = {
    calculateVGIndex
};
