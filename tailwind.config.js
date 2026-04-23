/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./frontend/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        // Ivory — backgrounds and surfaces
        ivory: {
          DEFAULT: "#FDFBF7",
          cream:   "#F5F0E8",
          linen:   "#EDE5D8",
          sand:    "#D9CFC0",
          dune:    "#BFB3A0",
        },
        // Charcoal — all text and dark UI
        charcoal: {
          DEFAULT: "#2A2218",
          umber:   "#4A3F32",
          stone:   "#8A7D6B",
          ash:     "#C8BFB2",
          mist:    "#F2EFEB",
        },
        // Bronze gold — CTAs, prices, stars
        gold: {
          DEFAULT: "#B8882A",
          light:   "#D4A843",
          honey:   "#F0D596",
          champagne: "#FBF4E6",
          bronze:  "#8C6218",
          bark:    "#4A3208",
        },
        // Deep teal — navbar, footer, hero
        teal: {
          DEFAULT: "#1F6460",
          dark:    "#0D3330",
          night:   "#061A18",
          mid:     "#4A9490",
          mist:    "#A8CCC8",
          light:   "#E8F2F0",
        },
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans:  ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": "0.6875rem", // 11px — captions
      },
      borderColor: {
        DEFAULT: "#C8BFB2",
      },
    },
  },
  plugins: [],
}