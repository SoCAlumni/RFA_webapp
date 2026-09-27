import { InboxView } from "@/components/inbox/InboxView";

/**
 * /inbox                 결재함 전체
 * /inbox/:task           태스크별 결재함
 * /inbox/:scope/:itemId  결재 상세 (scope = all | 태스크 id, itemId = GET /inbox 의 id)
 */
export default async function InboxPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug = [] } = await params;
  const [scope = "all", itemId] = slug.map(decodeURIComponent);
  return <InboxView scope={scope} itemId={itemId} />;
}
