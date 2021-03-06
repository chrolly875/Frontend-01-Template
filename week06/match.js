// 使用状态机完成”abababx”的处理

function match(string) {
    let state = start;
    for (let c of string) {
        console.log(c);
        state = state(c);
    }
    return state === end;
}

function start(c) {
    if (c === "a") {
        return foundA;
    } else {
        return start;
    }
}

function end(c) {
    return end;
}

function foundA(c) {
    if (c === "b") {
        return foundB;
    } else {
        return start(c);
    }
}

function foundB(c) {
    if (c === "a") {
        return foundA2;
    } else {
        return start(c);
    }
}

function foundA2(c) {
    if (c === "b") {
        return foundA3;
    } else {
        return start(c);
    }
}

function foundA3(c) {
    if (c === "a") {
        return foundB3;
    } else {
        return start(c);
    }
}

function foundB3(c) {
    if (c === "b") {
        return foundX;
    } else {
        return start(c);
    }
}

function foundX(c) {
    if (c === "x") {
        return end;
    } else {
        return foundA3(c);
    }
}

console.log(match("ababababx"));