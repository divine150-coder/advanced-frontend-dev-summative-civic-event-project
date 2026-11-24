/** Tailwind build config. The compiled output is committed as css/tailwind.css, so the app runs with no internet / no build step.
 *  To rebuild after changing classes:  npx tailwindcss@3 -i ./src/input.css -o ./css/tailwind.css --minify */
module.exports = {
  content: ['./*.html', './js/**/*.js'],
  theme: { extend: {} },
  plugins: []
};
