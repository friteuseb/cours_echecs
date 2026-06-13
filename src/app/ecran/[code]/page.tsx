import ScreenView from '@/components/ScreenView'

export default async function EcranPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <ScreenView code={code.toUpperCase()} />
}
