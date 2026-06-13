import PlayView from '@/components/PlayView'

export default async function JouerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <PlayView code={code.toUpperCase()} />
}
