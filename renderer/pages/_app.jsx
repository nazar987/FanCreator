
import { MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import '@mantine/core/styles.css'
import '../../styles/global.css'

export default function App({ Component, pageProps }) {
  return (
    <MantineProvider defaultColorScheme="light" theme={{ fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial' }}>
      <ModalsProvider>
        <Component {...pageProps} />
      </ModalsProvider>
    </MantineProvider>
  )
}
