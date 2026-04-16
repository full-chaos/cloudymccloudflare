// Tailwind v4 moved the PostCSS plugin to a separate package.
// Autoprefixer / vendor prefixing is now built in via Lightning CSS.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
