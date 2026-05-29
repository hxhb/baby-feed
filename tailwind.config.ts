import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          500: '#3b82f6',
          600: '#2563eb',
        },
        accent: {
          breast: '#ec4899',
          formula: '#3b82f6',
          ad: '#f97316',
          health: '#10b981',
          sleep: '#8b5cf6',
          diaper: '#f59e0b',
        },
      },
      borderRadius: {
        'card': '20px',
        'button': '16px',
        'element': '12px',
      },
      boxShadow: {
        'card': '0 2px 16px rgba(59, 130, 246, 0.08)',
        'elevated': '0 4px 20px rgba(59, 130, 246, 0.25)',
        'pressed': '0 1px 4px rgba(59, 130, 246, 0.12)',
        'nav': '0 -2px 20px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
};
export default config;
