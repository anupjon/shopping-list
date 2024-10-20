import "./globals.css"

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Shopping List</title>
        <link rel="preconnect" href="https://fonts.googleapis.com"></link>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin></link>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+Malayalam:wght@100..900&display=swap" rel="stylesheet"></link>
      </head>
      <body>{children}</body>
    </html>
  )
}
