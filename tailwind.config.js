/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                accent: {
                    primary: 'var(--accent-primary)',
                    secondary: 'var(--accent-secondary)',
                }
            }
        },
    },
    plugins: [],
}
