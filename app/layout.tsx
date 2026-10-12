import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Common. Your place to be, together.',description:'Find a Moment. Join people. Share an experience. Meet again.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
