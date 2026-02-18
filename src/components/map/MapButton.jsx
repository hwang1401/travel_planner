import Button from '../common/Button';
import { openExternalUrl } from '../../utils/openExternal';

/* ── MapButton (external Google Maps link) ── */
export default function MapButton({ query }) {
  return (
    <Button variant="neutral" size="xsm" iconLeft="pin"
      onClick={(e) => {
        e.stopPropagation();
        openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
      }}
      style={{
        padding: "4px 10px", height: "auto", whiteSpace: "nowrap",
      }}>
      지도
    </Button>
  );
}
