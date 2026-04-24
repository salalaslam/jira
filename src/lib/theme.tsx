import * as React from "react";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
	theme: Theme;
	resolvedTheme: ResolvedTheme;
	setTheme: (theme: Theme) => void;
};

const THEME_KEY = "byome-jira-theme";

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getStoredTheme(): Theme {
	if (typeof window === "undefined") return "system";
	const stored = window.localStorage.getItem(THEME_KEY);
	return stored === "light" || stored === "dark" || stored === "system"
		? stored
		: "system";
}

function getSystemTheme(): ResolvedTheme {
	if (typeof window === "undefined") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
}

function applyTheme(theme: Theme) {
	if (typeof document === "undefined") return getSystemTheme();

	const resolved = theme === "system" ? getSystemTheme() : theme;
	document.documentElement.classList.toggle("dark", resolved === "dark");
	document.documentElement.style.colorScheme = resolved;
	return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = React.useState<Theme>(() => getStoredTheme());
	const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(() =>
		applyTheme(getStoredTheme()),
	);

	React.useEffect(() => {
		setResolvedTheme(applyTheme(theme));

		if (theme !== "system") return;

		const media = window.matchMedia("(prefers-color-scheme: dark)");
		const onChange = () => setResolvedTheme(applyTheme("system"));
		media.addEventListener("change", onChange);
		return () => media.removeEventListener("change", onChange);
	}, [theme]);

	const setTheme = React.useCallback((nextTheme: Theme) => {
		if (nextTheme === "system") {
			window.localStorage.removeItem(THEME_KEY);
		} else {
			window.localStorage.setItem(THEME_KEY, nextTheme);
		}
		setThemeState(nextTheme);
		setResolvedTheme(applyTheme(nextTheme));
	}, []);

	const value = React.useMemo<ThemeContextValue>(
		() => ({ theme, resolvedTheme, setTheme }),
		[theme, resolvedTheme, setTheme],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme() {
	const ctx = React.useContext(ThemeContext);
	if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
	return ctx;
}

export const themeInitScript = `(() => {
	try {
		const stored = localStorage.getItem("${THEME_KEY}");
		const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
		const resolved = stored === "light" || stored === "dark" ? stored : systemDark ? "dark" : "light";
		document.documentElement.classList.toggle("dark", resolved === "dark");
		document.documentElement.style.colorScheme = resolved;
	} catch {}
})();`;
