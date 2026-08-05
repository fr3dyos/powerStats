import { EmptyState } from "@/app/_components/EmptyState";
import { getServerLocale } from "@/utils/i18n-server";

/**
 * Friendly 404 for genuinely missing player IDs.
 *
 * Built with the shared `EmptyState` (visual basis: the Player Not Found /
 * Empty State Stitch template) so the dead-end renders a branded page with
 * a link back to the player directory instead of a generic error.
 */
export default async function PlayerNotFound() {
  const { dict } = await getServerLocale();
  const common = dict.common;
  const nav = dict.navigation;
  const nf = dict.notFound;

  return (
    <EmptyState
      title={nf.playerTitle}
      description={nf.playerDescription}
      actionLabel={common.back}
      actionHref="/players"
      secondaryLabel={nav.tournaments}
      secondaryHref="/tournaments"
      actionMode="primary"
    />
  );
}
