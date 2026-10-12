import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Common. Your feed. Your interests. Your community.',description:'Videos, photos, discussions, and customizable Worlds. One post. Many Worlds.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
