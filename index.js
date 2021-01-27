#!/usr/bin/env node

const args = process.argv.slice(2)

const letters = args
    .filter(str => str.startsWith('-'))
    .map(str => str.substr(1))
    .join()
const options = {
    latex: /[l]/g.test(letters)
}

const input = args.filter(str => !str.startsWith('-'))[0]

const syntax = parser(input)

function parser (input) {
    const ops = {
        '|': 'or',
        '&': 'and',
        '*': 'xor',
        '!': 'not',
        '>': 'implication',
        '^': 'biconditional'
    }
    let reg = new RegExp('[a-zA-Z]+|[\|\&\!\(\)\*\<\>\^]', 'y')
    let token
    let context = node()
    while ((token = reg.exec(input)) !== null) {
        if (ops.hasOwnProperty(token[0])) {
            context.operator = ops[token[0]]
        } else if (token[0] === '(') {
            let child = node(context)
            context.children.push(child)
            context = child
        } else if (token[0] === ')') {
            context = context.parent
        } else {
            context.children.push(token[0])
        }
    }
    return context

    function node (parent) {
        return {
            parent,
            operator: null,
            children: []
        }
    }
}


let operations = findOperations(syntax)

function findOperations (node) {
    if (typeof node === 'string') return node

    const children = node.children.map(child => findOperations(child))

    if (node.operator === 'not') {
        const only = children[0]
        return {
            comp: only => !only,
            title: only => `˜${only}`,
            latex: only => `\\sim ${only}`,
            children: [only]
        }
    } else if (node.operator === 'and') {
        const [left, right] = children
        return {
            comp: (left, right) => left && right,
            title: (left, right) => `${left} ∧ ${right}`,
            latex: (left, right) => `${left}\\wedge ${right}`,
            children: [left, right]
        }
    } else if (node.operator === 'or') {
        const [left, right] = children
        return {
            comp: (left, right) => left || right,
            title: (left, right) => `${left} ∨ ${right}`,
            latex: (left, right) => `${left}\\vee ${right}`,
            children: [left, right]
        }
    } else if (node.operator === 'xor') {
        const [left, right] = children
        return {
            comp: (left, right) => (left || right) && !(left && right),
            title: (left, right) => `${left} ⊕ ${right}`,
            latex: (left, right) => `${left}\\oplus ${right}`,
            children: [left, right]
        }
    } else if (node.operator === 'implication') {
        const [left, right] = children
        return {
            comp: (left, right) => !left || (left && right),
            title: (left, right) => `${left} ⇒ ${right}`,
            latex: (left, right) => `${left}\\Rightarrow ${right}`,
            children: [left, right]
        }
    } else if (node.operator === 'biconditional') {
        const [left, right] = children
        return {
            comp: (left, right) => left === right,
            title: (left, right) => `${left} ⇔  ${right}`,
            latex: (left, right) => `${left}\\Leftrightarrow ${right}`,
            children: [left, right]
        }
    }
}


let statements = new Set()
function findTokens (node) {
    if (typeof node === 'string') {
        statements.add(node)
    } else {
        node.children.forEach(c => findTokens(c))
    }
}

findTokens(syntax)

statements = Array.from(statements.values())

const scenarioCount = Math.pow(2, statements.length)
let scenarios = new Array(scenarioCount)
    .fill().map(() => ({
        statements: new Map(),
        operations: []
    }))

for (let f = 0; f < statements.length; f++) {
    const repeat = Math.pow(2, statements.length - f)
    for (let r = 0; r < scenarios.length; r++) {
        const on = r % repeat
        scenarios[r].statements.set(statements[f], on < repeat / 2)
    }
}


const lookup = row => ref => {
    if (typeof ref === 'string') {
        return row.statements.get(ref)
    } else if (typeof ref === 'number') {
        return row.operations[ref]
    }
}

let titles = [...statements]
let operationsList = []
function collectOperations(operation) {
    if (typeof operation != 'string') {
        operationsList.push(operation)
        operation.children.forEach(collectOperations)
    }
}
collectOperations(operations)
operationsList.reverse()

function buildTitle (node) {
    if (typeof node === 'string') {
        return node
    } else {
        return node.latex.apply(null, node.children.map(buildTitle))
    }
}

for (let o = 0; o < operationsList.length; o++) {
    const op = operationsList[o]
    titles.push(
        `$${buildTitle(op)}$`
    )
}

const padding = ' & '
console.log(titles.join(padding)  + ' \\\\')

for (let r = 0; r < scenarios.length; r++) {
    for (let o = 0; o < operationsList.length; o++) {
        scenarios[r].operations[o] = operationsList[o].comp.apply(null, operationsList[o].children.map(lookup(scenarios[r])))
    }
    const write = statements.map(name => scenarios[r].statements.get(name))
        .concat(scenarios[r].operations)
        .map(b => b ? 'T' : 'F') // HERE
        .map((b, ind) => b.padStart(Math.ceil(titles[ind].length/2)).padEnd(titles[ind].length))
        .join(padding)
    console.log(write + ' \\\\')
}
