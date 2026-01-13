import vm from 'node:vm';
import { fetch } from 'undici';
import UserAgent from 'user-agents';
import puppeteer from 'puppeteer';
import { parseSync } from 'oxc-parser';
import type * as estree from "estree";
import UndetectedBrowser from 'undetected-browser';
import elysia from 'elysia';
import { JSDOM } from 'jsdom';
import 'dotenv/config';

function parseUA(userAgent: string): Partial<Navigator> {
    let ua = userAgent.split(' ').map(part => {
        const [key, value] = part.split('/');
        return { key, value };
    });
    return {
        appName: ua[2]?.key || '',
        appVersion: ua[2]?.value || '',
        platform: (ua[0]?.key || 'Win32') as Navigator['platform'],
        vendor: ua[1]?.key || '',
        vendorSub: ua[1]?.value || '',
        appCodeName: ua[0]?.key || '',
        // Garbage data. They don't access this much.
        product: 'Gecko',
        productSub: '20030107',
        doNotTrack: '1',
    };
}

function fauxNavigator(userAgent: string): Navigator {
    return {
        ...parseUA(userAgent),
        userAgent: userAgent,
        onLine: true,
        userActivation: {
            hasBeenActive: false,
            isActive: false
        }
    } as Partial<Navigator> as Navigator;
}

const s = {
    ps_base: process.env.PS_BASE || "holyghostprep",
    ps_username: process.env.PS_USERNAME || "your_username",
    ps_password: process.env.PS_PASSWORD || "your_password",
    guardian: process.env.PS_GUARDIAN === 'true' || false,
    env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        port: parseInt(process.env.COOKIE_PORT || '8080', 10)
    }
}

export function runInContext(code: string, contextObj: Record<string, any> = {}, timeout: number = 1000): any {
    const context = vm.createContext(contextObj);
    const script = new vm.Script(code);
    return script.runInContext(context, { timeout });
}

// expose boilerplate to access variables from outer scope
/*
injects under variable definitions like:
const map = {};

function selectByPath(path: string) {
    const m = Object.entries(map).reduce((acc, [key, val]) => {
        acc[key] = val;
        return acc;
    }, {});
    let parts = path.split('.');
    let a = map;
    for (let part of parts) {
        a = a[part];
    }
    return a;
}

function grep(pattern: string, obj: string) {
    function parseGrepPattern(pattern: string): (key: string) => boolean {
        if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            return (key: string) => key.startsWith(prefix);
        }
        if (pattern.startsWith('*')) {
            const suffix = pattern.slice(1);
            return (key: string) => key.endsWith(suffix);
        }
        return (key: string) => key === pattern;
    }

    const matchFn = parseGrepPattern(pattern);
    const m = Object.entries(obj).reduce((acc, [key, val]) => {
        acc[key] = val;
        return acc;
    }, {});
    let result: Record<string, any> = {};
    for (let key in m) {
        if (matchFn(key)) {
            result[key] = m[key];
        }
    }
    return result;
}

// query i.e. anonymous_*.a.b.c
function selectByQuery(path: string) {
    const m = Object.entries(map).reduce((acc, [key, val]) => {
        acc[key] = val;
        return acc;
    }, {});
    let parts = path.split('.');
    let a = m;
    for (let part of parts) {
        a = grep(part, a);
    }
    return a;
}

function setByPath(path: string, value: any) {
    const m = Object.entries(map).reduce((acc, [key, val]) => {
        acc[key] = val;
        return acc;
    }, {});
    let parts = path.split('.');
    let a = map;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in a)) {
            a[part] = {};
        }
        a = a[part];
    }
    a[parts[parts.length - 1]] = value;
}

(function () {
var a = 1;
setByPath('anonymous_1.a', a);
var b = {};
b.c = 2;
setByPath('anonymous_1.b', b);
setByPath('anonymous_1.b.c', b.c);

var d = function() {
    b.c = 3;
    setByPath('anonymous_1.b.c', b.c);
    return b.c;
};
setByPath('anonymous_1.d', d);
})();

// Externally...

selectByQuery('anonymous_*.a');
*/
function injectAccessors(ast: estree.Program, accessors: Record<string, any>) {
    function traverse(node: estree.Node, cb: <T extends estree.Node>(node: T) => T): any {
        node = cb(node);
        for (const key in node) {
            if (node.hasOwnProperty(key)) {
                const child = node[key as keyof estree.Node];
                if (Array.isArray(child)) {
                    node[key as keyof estree.Node] = child.map((c) => typeof c === 'object' && c !== null ? traverse(c as unknown as estree.Node, cb) : c) as any;
                } else if (typeof child === 'object' && child !== null) {
                    node[key as keyof estree.Node] = traverse(child as unknown as estree.Node, cb);
                }
            }
        }
        return node;
    }

    return traverse(ast, ((node => {
        if (node.type === 'VariableDeclaration') {
            for (const decl of node.declarations) {
                if (decl.id.type === 'AssignmentPattern' || decl.id.type === 'ArrayPattern') {
                    const varName = (decl.id.type === 'AssignmentPattern') ? (decl.id.left.type === 'Identifier' ? decl.id.left.name : null) : null;
                    if (varName) {
                        const setterCode = `setByPath('${varName}', ${varName});`;
                        const setterAst = parseSync('setter.js', setterCode, {
                            astType: 'js',
                            sourceType: 'script'
                        });
                        if (node.type === 'VariableDeclaration') {
                            if (!node.declarations[0]!.init) continue;
                            const body = (node as estree.VariableDeclaration & { parent?: estree.Node }).parent;
                            if (body && body.type === 'Program') {
                                body.body.splice(body.body.indexOf(node) + 1, 0, ...setterAst.program!.body.map(statement => {
                                    return statement.type === 'ExpressionStatement' ? statement : {
                                        type: 'ExpressionStatement',
                                        expression: statement.expression as estree.Literal
                                    } as estree.ExpressionStatement;
                                }) as any);
                            }
                        }
                    }
                }
            }
            return node;
        }
        return node;
    }) as <T extends estree.Node>(node: T) => T));
}

function injectSetters(ast: estree.Program, setters: Record<string, any>) {
    function traverse(node: estree.Node, cb: <T extends estree.Node>(node: T) => T): any {
        node = cb(node);
        for (const key in node) {
            if (node.hasOwnProperty(key)) {
                const child = node[key as keyof estree.Node];
                if (Array.isArray(child)) {
                    node[key as keyof estree.Node] = child.map((c) => typeof c === 'object' && c !== null ? traverse(c as unknown as estree.Node, cb) : c) as any;
                }
                else if (typeof child === 'object' && child !== null) {
                    node[key as keyof estree.Node] = traverse(child as unknown as estree.Node, cb);
                }
            }
        }
        return node;
    }
    return traverse(ast, ((node => {
        if (node.type === 'AssignmentExpression' && node.operator === '=') {
            if (node.left.type === 'Identifier') {
                const varName = node.left.name;
                const setterCode = `window.${varName} = ${varName}; setByPath('global.${varName}', ${varName});`;
                const setterAst = parseSync('setter.js', setterCode, {
                    astType: 'js',
                    sourceType: 'script'
                });
                const body = (node as estree.AssignmentExpression & { parent?: estree.Node }).parent;
                if (body && body.type === 'Program') {
                    body.body.splice(body.body.indexOf(node) + 1, 0, ...setterAst.program!.body.map(statement => {
                        return statement.type === 'ExpressionStatement' ? statement : {
                            type: 'ExpressionStatement',
                            expression: statement.expression as estree.Literal
                        } as estree.ExpressionStatement;
                    }) as any);
                }
            }
        }
        return node;
    }) as <T extends estree.Node>(node: T) => T));
}


abstract class Storage {
    abstract getItem(key: string): string | null;
    abstract setItem(key: string, value: string): void;
    abstract removeItem(key: string): void;
    abstract clear(): void;
    abstract get length(): number;
    abstract key(index: number): string | null;
}

class TurdStorage extends Storage {
    private storage: Record<string, string> = {};

    override getItem(key: string): string | null {
        return this.storage[key] || null;
    }

    override setItem(key: string, value: string): void {
        this.storage[key] = value;
    }

    override removeItem(key: string): void {
        delete this.storage[key];
    }

    override clear(): void {
        this.storage = {};
    }

    override get length(): number {
        return Object.keys(this.storage).length;
    }

    override key(index: number): string | null {
        const keys = Object.keys(this.storage);
        return keys[index] || null;
    }
}

function filterUndefinedNodes(ast: estree.Program): estree.Program {
    function traverse(node: estree.Node): estree.Node | null {
        for (const key in node) {
            if (node.hasOwnProperty(key)) {
                const child = node[key as keyof estree.Node];
                if (Array.isArray(child)) {
                    node[key as keyof estree.Node] = child.map((c) => {
                        if (typeof c === 'object' && c !== null) {
                            return traverse(c as unknown as estree.Node);
                        }
                        return c;
                    }).filter(c => c !== null) as any;
                } else if (typeof child === 'object' && child !== null) {
                    const traversedChild = traverse(child as unknown as estree.Node);
                    if (traversedChild === null) {
                        delete node[key as keyof estree.Node];
                    } else {
                        node[key as keyof estree.Node] = traversedChild! as any;
                    }
                }
            }
        }
        if (node.type === 'EmptyStatement') {
            return null;
        }
        return node;
    }
    const result = traverse(ast);
    return result as estree.Program;
}

const validUAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
]

let glue: Record<string, {
    ua: string;
    login: { username: string; password: string; };
}> = {};

const browser = await new UndetectedBrowser(await puppeteer.launch({
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--window-size=1280,800',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--user-agent=' + validUAS[Math.floor(Math.random() * validUAS.length)]
    ],
    defaultViewport: {
        width: 1280,
        height: 800
    },
    browser: "chrome"
})).getBrowser();

export async function extractCookie(ip?: string): Promise<{ userAgent: string, cookie: string }> {
    // const downloaded = await download();
    // if (!downloaded) {
    //     throw new Error('Download returned undefined');
    // }
    // const reese = downloaded;

    // const boilerplate = `...`;

    // let proxy = new Proxy(() => {}, {
    //     get(target, prop, receiver) {
    //         console.log(`Accessed property: ${String(prop)}`);
    //         return Reflect.get(target, prop, receiver);
    //     },
    //     set(target, prop, value, receiver) {
    //         console.log(`Set property: ${String(prop)} to value: ${value}`);
    //         return Reflect.set(target, prop, value, receiver);
    //     }
    // });
    // const code = boilerplate + '\n' + codegen.generate(filterUndefinedNodes(injectSetters(injectAccessors({
    //     type: 'Program',
    //     body: reese,
    //     sourceType: 'script'
    // }, {}), {
    //     A: proxy
    // })));
    glue[ip || 'default'] = {
        ua: validUAS[Math.floor(Math.random() * validUAS.length)]!,
    } as typeof glue[string];

    // Launch Puppeteer browser

    const page = await browser.newPage();

    await page.setUserAgent({
        userAgent: glue[ip || 'default']!.toString()
    });

    await page.goto("https://" + s.ps_base + `.powerschool.com/${s.guardian ? "public" : "teachers"}/`, { waitUntil: 'networkidle2' });

    // Evaluate code in the context of the page
    const cookie = await page.evaluate(() => {
        const script = document.head.getElementsByTagName("script")[0];
        (new Function(script!.innerHTML)).bind(window)();
        const reese = (window as any).reese84;
        if (typeof reese === 'function') {
            return reese();
        }
        return document.cookie;
    });
    // Close page
    await page.close();
    // Close browser
    await browser.close();

    return {
        userAgent: glue[ip || 'default']!.toString(),
        cookie: cookie
    }
}

export async function login(cookie: string, username: string, password: string, ip?: string): Promise<{ userAgent: string, cookie: string, error?: string, expanded?: string }> {
    const loginUrl = `https://${s.ps_base}.powerschool.com/${s.guardian ? "guardian" : "teachers"}/home.html`;
    const loginResponse = await fetch(loginUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': glue[ip || 'default']!.toString(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Referer': `https://${s.ps_base}.powerschool.com/${s.guardian ? "public" : "teachers"}/`,
            'Cookie': cookie
        },
        body: new URLSearchParams({
            'dbpw': 't',
            'translator_username': '',
            'translator_password': '',
            'translator_ldappassword': '',
            'returnUrl': '',
            'serviceName': 'PS Parent Portal',
            'serviceTicket': '',
            'pcasServerUrl': '/',
            'credentialType': 'User Id and Password Credential',
            'account': username,
            'pw': password,
            'translatorpw': ''
        }).toString()
    });
    console.log('Login response status:', loginResponse.status);
    const cookies = loginResponse.headers.get('set-cookie') || '';
    const response = await loginResponse.text();
    console.log('Login response body:', response);
    console.log('Login response cookies:', cookies);
    const parsed = new JSDOM(response);

    glue[ip || 'default']!.login = {
        username,
        password
    };

    if ([...parsed.window.document.body.querySelectorAll(".feedback-alert")].length > 1) {
        return {
            error: 'Invalid',
            expanded: 'Invalid username or password provided. CAPTCHA may also have failed to complete.',
            userAgent: glue[ip || 'default']!.toString(),
            cookie: cookies
        };
    }

    return {
        userAgent: glue[ip || 'default']!.toString(),
        cookie: cookies
    };
}

if (import.meta.main) {
    const app = new elysia({
        serve: { port: s.env.port || 8080 }
    }).post('/cookie', async ({ body, request, server }) => {
        const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || request.headers.get('true-client-ip') || request.headers.get('x-real-ip') || server?.requestIP(request)?.address || 'default';
        const { username, password } = body as { username: string, password: string };
        const { userAgent, cookie: initialCookie } = await extractCookie(clientIp);
        const { cookie: loginCookie, error: possibleError, expanded: possibleExpanded } = await login(initialCookie, username, password, clientIp);
        return {
            ua: userAgent,
            cookie: initialCookie + '; ' + loginCookie,
            error: possibleError,
            expanded: possibleExpanded
        };
    }).get('/', ({ set }) => {
        set.headers['Content-Type'] = 'text/html';
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cookie Extractor</title>
</head>
<body>
    <h1>Cookie Extractor</h1>
    <form id="cookieForm">
        <label for="username">Username:</label>
        <input type="text" id="username" name="username" required>
        <br>
        <label for="password">Password:</label>
        <input type="password" id="password" name="password" required>
        <br>
        <button type="submit">Get Cookie</button>
    </form>
    <pre id="result"></pre>
    <script>
        document.getElementById('cookieForm').addEventListener('submit', async function(event) {
            event.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const start = performance.now();
            const response = await fetch('/cookie', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            const end = performance.now();
            document.getElementById('result').textContent = 'User-Agent: ' + data.ua.toString() + '\\nCookie: ' + data.cookie;
            if (data.error) {
                document.getElementById('result').textContent += '\\nError: ' + data.error + ' : ' + data.expanded;
            }
            document.getElementById('result').textContent += '\\nTime taken: ' + (end - start).toFixed(2) + ' ms';
        });
    </script>
</body>
</html>
        `;
    }).listen({
        port: s.env.port || 8080,
    });
    console.log(`Server running on port ${s.env.port || 8080}`);

    autorenewCookies();
}

async function autorenewCookies() {
    while (true) {
        for (const ip in glue) {
            try {
                const { userAgent, cookie: initialCookie } = await extractCookie(ip);
                const { cookie: loginCookie } = await login(initialCookie, glue[ip]!.login.username, glue[ip]!.login.password, ip);
                glue[ip] = {
                    ua: userAgent,
                    login: glue[ip]!.login
                };
                console.log(`Auto-renewed cookie for IP ${ip}`);
            } catch (e) {
                console.error(`Failed to auto-renew cookie for IP ${ip}:`, e);
            }
        }
        await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
    }
}

async function pullDaily() {

}