console.clear();
console.log("Simulador PDA cargado correctamente");

// PDA para el lenguaje: L = { x^(2n) y^m x^(3m) y^n z^+ | n, m ≥ 1 }

const svgStates = ["q0", "q1", "q2", "q3", "q4", "q5", "q6", "q7"];
let machine = null;
let runTimer = null;

// Elementos del DOM
const $log = document.getElementById("log");
const $stack = document.getElementById("stack");
const $cad = document.getElementById("cadena");
const $alerta = document.getElementById("alerta");
const $derivacionLista = document.getElementById("derivacion-lista");
const $idFormal = document.getElementById("id-formal");

// Botones
document.getElementById("btn-load").onclick = loadInput;
document.getElementById("btn-step").onclick = stepOnce;
document.getElementById("btn-run").onclick = runAll;
document.getElementById("btn-reset").onclick = resetAll;

// Estado inicial
highlight("q0");
renderStack(["Z"]);
appendLog("Simulador listo. Escribe una cadena y presiona 'Cargar'.");

// -------------------- MÁQUINA --------------------
function initialMachine(input) {
    const entrada = input.trim().split("");
    return { entrada, i: 0, pila: ["Z"], estado: "q0", halted: false, accepted: false };
}

// -------------------- VALIDACIÓN --------------------
function validateLanguage(str) {
    const match = str.match(/^(x+)(y+)(x+)(y+)(z+)$/);
    if (!match) {
        return {
            valid: false,
            reason: "No sigue el patrón xⁿ yᵐ xᵏ yˡ z⁺ (todas deben estar presentes y en orden)."
        };
    }

    const [, x1, y1, x2, y2, z] = match;
    const n = x1.length / 2;
    const m = y1.length;

    // Validaciones estructurales
    if (x1.length < 2)
        return { valid: false, reason: "Debe haber al menos dos 'x' iniciales (x²ⁿ)." };

    if (x1.length % 2 !== 0)
        return { valid: false, reason: "Las primeras 'x' deben ser pares (2n)." };

    if (y1.length < 1)
        return { valid: false, reason: "Debe haber al menos una 'y' (yᵐ)." };

    if (x2.length % 3 !== 0)
        return { valid: false, reason: "Las 'x' intermedias deben ser múltiplos de tres (x³ᵐ)." };

    if (x2.length !== 3 * m)
        return {
            valid: false,
            reason: `El bloque x^{3m} tiene longitud ${x2.length}, pero debería ser ${3 * m} (3 × m).`
        };

    if (y2.length !== n)
        return {
            valid: false,
            reason: `Las 'y' finales (${y2.length}) deben ser n = x₁/2 = ${n}.`
        };

    if (z.length < 1)
        return { valid: false, reason: "Debe haber al menos una 'z' (z⁺)." };

    return {
        valid: true,
        reason: "Cadena válida según el lenguaje definido."
    };
}

// -------------------- CARGA --------------------
function loadInput() {
    const s = ($cad.value || "").trim();
    if (!s) return alert("Ingresa una cadena, por favor.");

    const check = validateLanguage(s);
    if (!check.valid) {
        $alerta.innerHTML = `<b>Cadena inválida:</b> "${s}"<br>${check.reason}`;
        $derivacionLista.innerHTML = "<em>Cadena no válida. Derivación no generada.</em>";
        $idFormal.textContent = "Cadena no válida. No se genera ID formal.";
    } else {
        $alerta.innerHTML = `<b>Cadena válida:</b> "${s}"<br>${check.reason}`;
        const pasos = derivarCadena(s);
        $derivacionLista.textContent = pasos.join("\n⇒ ");
        const formal = generarIDFormalSimple(s);
        $idFormal.textContent = formal.join("\n");
    }

    machine = initialMachine(s);
    svgStates.forEach(id => document.getElementById(id)?.classList.remove("active"));
    highlight(machine.estado);
    renderStack(machine.pila);
    $log.textContent = "";
    appendLog(`Cadena cargada: ${s}`);
}

// -------------------- CONTROLES --------------------
function resetAll() {
    stopRun();
    machine = null;
    $cad.value = "";
    $log.textContent = "";
    renderStack(["Z"]);
    highlight("q0");
    appendLog("Simulador reiniciado.");
    $alerta.innerHTML = "<em>Esperando cadena...</em>";
    $derivacionLista.innerHTML = "<em>Esperando cadena...</em>";
    $idFormal.textContent = "Esperando entrada formal...";
}

function ensureLoaded() {
    if (!machine) {
        alert("Primero presiona 'Cargar' con una cadena.");
        return false;
    }
    if (machine.halted) {
        alert("La máquina ya finalizó. Presiona 'Reset' para reiniciar.");
        return false;
    }
    return true;
}

function runAll() {
    if (!ensureLoaded()) return;
    stopRun();
    runTimer = setInterval(() => {
        if (!stepCore()) stopRun();
    }, 600);
}

function stopRun() {
    if (runTimer) {
        clearInterval(runTimer);
        runTimer = null;
    }
}

function stepOnce() {
    stopRun();
    if (!ensureLoaded()) return;
    stepCore();
}

// -------------------- PDA CORE --------------------
function stepCore() {
    const M = machine;
    const { entrada, i, pila, estado } = M;
    const simbolo = entrada[i] ?? null;
    const cima = pila[pila.length - 1] ?? null;

    if (estado === "q0") {
        if (simbolo === "x" && (cima === "Z" || cima === "a")) return goTo("q1", 1);
        if (simbolo === "y" && cima === "a") return goTo("q2", 1, () => pila.push("b"));
        return reject("Error en q0: se esperaba x o y con cima válida.");
    }

    if (estado === "q1") {
        if (simbolo === "x" && (cima === "Z" || cima === "a"))
            return goTo("q0", 1, () => pila.push("a"));
        return reject("Error en q1: se esperaba x.");
    }

    if (estado === "q2") {
        if (simbolo === "y" && cima === "b") return stayHere(1, () => pila.push("b"));
        if (simbolo === "x" && cima === "b") return goTo("q3", 1);
        if (simbolo === "y" && cima === "a") return goTo("q5", 1, () => pila.pop());
        return reject("Error en q2.");
    }

    if (estado === "q3") {
        if (simbolo === "x" && cima === "b") return goTo("q4", 1);
        return reject("Error en q3.");
    }

    if (estado === "q4") {
        if (simbolo === "x" && cima === "b") return goTo("q2", 1, () => pila.pop());
        return reject("Error en q4.");
    }

    if (estado === "q5") {
        if (simbolo === "y" && cima === "a") return stayHere(1, () => pila.pop());
        if (simbolo === "z" && cima === "Z") return goTo("q6", 1);
        if (simbolo === null) return reject("Falta z final.");
        return reject("Error en q5.");
    }

    if (estado === "q6") {
        if (simbolo === "z" && cima === "Z") return stayHere(1);
        if (simbolo === null && cima === "Z") return goTo("q7", 0, () => pila.pop());
        return reject("Error en q6.");
    }

    if (estado === "q7") {
        M.halted = true;
        M.accepted = true;
        appendLog("Cadena aceptada.");
        return false;
    }

    return reject("Estado desconocido.");
}

// -------------------- FUNCIONES DE TRANSICIÓN --------------------

function goTo(nuevo, consumed = 1, action = null) {
    const prev = machine.estado;
    const pilaAntes = [...machine.pila];
    if (action) action();
    const pilaDespues = [...machine.pila];

    recordID(prev, nuevo, consumed, pilaAntes, pilaDespues);
    machine.estado = nuevo;
    machine.i += consumed;

      animateTransition(prev, nuevo);

    moveTo(nuevo);
    renderStack(machine.pila);
    return true;
}

// Transición con bucle (mismo estado)
function stayHere(consumed = 1, action = null) {
    const estadoActual = machine.estado;
    const pilaAntes = [...machine.pila];
    if (typeof action === "function") action();
    const pilaDespues = [...machine.pila];

    recordID(estadoActual, estadoActual, consumed, pilaAntes, pilaDespues);
    machine.i += consumed;

    //activa la animación CSS de bucle
    animateTransition(estadoActual, estadoActual);

    renderStack(machine.pila);
    moveTo(estadoActual);
    return true;
}

// Registro de ID formal
function recordID(prev, next, consumed, pilaAntes, pilaDespues) {
    const entradaAntes = machine.entrada.slice(machine.i);
    const entradaDespues = machine.entrada.slice(machine.i + consumed);
    const fmt = (x) => (Array.isArray(x) ? x.join("") : x) || "ε";
    const restA = fmt(entradaAntes);
    const restB = fmt(entradaDespues);
    const pilaA = fmt(pilaAntes);
    const pilaB = fmt(pilaDespues);
    $log.textContent += `(${prev}, ${restA}, ${pilaA}) ⊢ (${next}, ${restB}, ${pilaB})\n`;
}

// Rechazo
function reject(msg) {
    machine.halted = true;
    machine.accepted = false;
    appendLog(" " + msg);
    return false;
}

// -------------------- CONTROL DE CLASES PARA ANIMACIÓN --------------------

// Esta función solo aplica o quita clases CSS
function animateTransition(prev, next) {
    const prevNode = document.getElementById(prev);
    const nextNode = document.getElementById(next);
    if (!nextNode) return;

    // Si es bucle (mismo estado)
    if (prev === next) {
        nextNode.classList.add("looping");
        setTimeout(() => nextNode.classList.remove("looping"), 600);
        return;
    }

    // Si es transición a otro estado
    nextNode.classList.add("transitioning");
    setTimeout(() => nextNode.classList.remove("transitioning"), 600);
}


// -------------------- UTILIDADES --------------------
function appendLog(l) { $log.textContent += l + "\n"; }
function renderStack(p) {
    $stack.innerHTML = "";
    p.forEach((s, i) => {
        const div = document.createElement("div");
        div.className = "cell" + (i === p.length - 1 ? " top" : "");
        div.textContent = s;
        $stack.appendChild(div);
    });
}
function moveTo(id) {
    svgStates.forEach((s) => {
        const el = document.getElementById(s);
        if (el) el.classList.remove("active");
    });
    highlight(id);
}
function highlight(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
}

// -------------------- GRAMÁTICA --------------------
const grammarRules = {
    S: ["xx A y C"],
    A: ["xx A y", "B"],
    B: ["y B xxx", "y xxx"],
    C: ["z C", "z"],
};

function derivarCadena(cadena) {
    const pasos = [];
    let actual = "S";
    pasos.push(actual);

    const bloques = cadena.match(/^(x+)(y+)(x+)(y+)(z+)$/);
    if (!bloques)
        return ["La cadena no cumple el patrón x^(2n) y^m x^(3m) y^n z^+."];

    const [_, X1, Y1, X2, Y2, Z] = bloques;
    const n = X1.length / 2;
    const m = Y1.length;
    const x3m = X2.length;
    const y2 = Y2.length;
    const zCount = Z.length;

    if (!Number.isInteger(n) || n < 1)
        return ["Error: la cantidad de x inicial no es múltiplo de 2."];
    if (x3m !== 3 * m)
        return [`Error: x^(3m) debería ser ${3 * m}, pero es ${x3m}.`];
    if (y2 !== n)
        return [`Error: y finales (${y2}) deben ser iguales a n=${n}.`];

    actual = actual.replace("S", grammarRules.S[0]);
    pasos.push(actual);

    for (let i = 1; i < n; i++) {
        actual = actual.replace("A", grammarRules.A[0]);
        pasos.push(actual);
    }

    actual = actual.replace("A", grammarRules.A[1]);
    pasos.push(actual);

    for (let i = 0; i < m - 1; i++) {
        actual = actual.replace("B", grammarRules.B[0]);
        pasos.push(actual);
    }

    actual = actual.replace("B", grammarRules.B[1]);
    pasos.push(actual);

    for (let i = 0; i < zCount - 1; i++) {
        actual = actual.replace("C", grammarRules.C[0]);
        pasos.push(actual);
    }

    actual = actual.replace("C", grammarRules.C[1]);
    pasos.push(actual);

    pasos.push(cadena);
    return pasos;
}

function generarIDFormalSimple(cadena) {
    const pasos = [];
    const fmt = (x) => (x && x.length ? x : "ε");

    let entrada = cadena.split("");
    let pila = ["Z"];
    let estado = "q0";

    // --- función auxiliar para registrar cada paso ---
    function emitir(prev, next, pilaAntes, pilaDespues, entradaRestante) {
        const mostrarPila = (p) => fmt([...p].reverse().join(""));
        pasos.push(`(${prev}, ${fmt(entradaRestante.join(""))}, ${mostrarPila(pilaAntes)}) ⊢ (${next}, ${fmt(entradaRestante.join(""))}, ${mostrarPila(pilaDespues)})`);
    }

    // --- Paso inicial ---
    const pilaAntes = [...pila];
    pila.push("S");
    emitir("q0", "q1", pilaAntes, pila, entrada);
    estado = "q1";

    // --- Ciclo principal ---
    while (pila.length > 0) {
        const cima = pila[pila.length - 1];

        // --- S ---
        if (cima === "S") {
            const pilaAntes2 = [...pila];
            pila.pop();
            // S → xx A y C
            pila.push("C");
            pila.push("y");
            pila.push("A");
            pila.push("x");
            pila.push("x");
            emitir(estado, estado, pilaAntes2, [...pila], entrada);
            continue;
        }

        // --- A ---
        if (cima === "A") {
            const pilaAntes2 = [...pila];
            pila.pop();

            if (entrada[0] === "x") {
                // A → xx A y
                pila.push("y");
                pila.push("A");
                pila.push("x");
                pila.push("x");
            } else {
                // A → B
                pila.push("B");
            }

            emitir(estado, estado, pilaAntes2, [...pila], entrada);
            continue;
        }
        // --- B ---
        if (cima === "B") {
            const pilaAntes2 = [...pila];
            pila.pop();

            if (entrada[0] === "y") {
                // B → y B xxx
                pila.push("x");
                pila.push("x");
                pila.push("x");
                pila.push("B");
                pila.push("y");
            } else {
                // No más 'y', eliminar B sin expandir

            }

            emitir(estado, estado, pilaAntes2, [...pila], entrada);
            continue;
        }
        // --- C ---
        if (cima === "C") {
            const pilaAntes2 = [...pila];
            pila.pop();

            // C → z C | z
            if (entrada.filter(ch => ch === "z").length > 1) {
                pila.push("C");
                pila.push("z");
            } else {
                pila.push("z");
            }

            emitir(estado, estado, pilaAntes2, [...pila], entrada);
            continue;
        }

        // --- Consumo de terminales ---
        if (["x", "y", "z"].includes(cima)) {
            if (entrada[0] === cima) {
                const pilaAntes2 = [...pila];
                pila.pop();
                entrada.shift();
                emitir(estado, estado, pilaAntes2, [...pila], entrada);
                continue;
            } else {
                pasos.push(`Error: esperaba '${cima}', pero se encontró '${entrada[0] || "ε"}'.`);
                break;
            }
        }

        // --- Finalización ---
        if (cima === "Z" && entrada.length === 0) {
            const pilaAntes2 = [...pila];
            pila.pop();
            emitir(estado, "q2", pilaAntes2, [], entrada);
            pasos.push("(q2, ε, ε) Cadena aceptada");
            break;
        }

        break;
    }

    return pasos;
}