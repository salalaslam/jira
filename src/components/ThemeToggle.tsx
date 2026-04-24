import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { useTheme } from "#/lib/theme";

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			title={isDark ? "Switch to light mode" : "Switch to dark mode"}
			aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
		>
			{isDark ? (
				<SunIcon className="h-4 w-4" />
			) : (
				<MoonIcon className="h-4 w-4" />
			)}
		</Button>
	);
}
