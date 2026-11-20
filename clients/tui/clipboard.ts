export interface Osc52Clipboard {
    copyToClipboardOSC52(text: string): boolean;
}

export interface NativeClipboard {
    copy(text: string): Promise<void>;
}

export interface CopyTuiTextOptions {
    readonly platform?: NodeJS.Platform;
    readonly nativeClipboard?: NativeClipboard;
    /** Whether this Linux host is WSL. Defaults to the environment. */
    readonly wsl?: boolean;
}

export async function copyTuiText(
    text: string,
    clipboard: Osc52Clipboard,
    options: CopyTuiTextOptions = {},
): Promise<void> {
    const platform = options.platform ?? process.platform;
    const wsl = platform === "linux" && (options.wsl ?? isWsl());
    let nativeError: unknown;

    // clip.exe reaches the Windows clipboard even when the terminal ignores OSC 52.
    const native = options.nativeClipboard
        ?? (platform === "darwin"
            ? macClipboard
            : wsl
            ? wslClipboard
            : undefined);
    if (native !== undefined) {
        try {
            await native.copy(text);
            return;
        } catch (error) {
            nativeError = error;
        }
    }

    if (clipboard.copyToClipboardOSC52(text)) {
        return;
    }

    if (nativeError instanceof Error) {
        throw nativeError;
    }
    throw new Error("The terminal does not support clipboard copy");
}

function isWsl(): boolean {
    return process.env.WSL_DISTRO_NAME !== undefined
        || process.env.WSL_INTEROP !== undefined;
}

const wslClipboard: NativeClipboard = {
    async copy(text: string): Promise<void> {
        const subprocess = Bun.spawn(["clip.exe"], {
            stdin: "pipe",
            stdout: "ignore",
            stderr: "pipe",
        });
        subprocess.stdin.write(text);
        subprocess.stdin.end();

        const exitCode = await subprocess.exited;
        if (exitCode !== 0) {
            const stderr = await new Response(subprocess.stderr).text();
            throw new Error(stderr.trim() || "clip.exe failed");
        }
    },
};

const macClipboard: NativeClipboard = {
    async copy(text: string): Promise<void> {
        const subprocess = Bun.spawn(["/usr/bin/pbcopy"], {
            stdin: "pipe",
            stdout: "ignore",
            stderr: "pipe",
        });
        subprocess.stdin.write(text);
        subprocess.stdin.end();

        const exitCode = await subprocess.exited;
        if (exitCode !== 0) {
            const stderr = await new Response(subprocess.stderr).text();
            throw new Error(stderr.trim() || "pbcopy failed");
        }
    },
};

export function countTuiCharacters(text: string): number {
    return Array.from(text).length;
}
