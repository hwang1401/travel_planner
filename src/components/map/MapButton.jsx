import Button from '../common/Button';

/* ── MapButton (external Google Maps link) ── */
export default function MapButton({ query }) {
  return (
    <Button variant="neutral" size="xsm" iconLeft="pin"
      onClick={(e) => {
        e.stopPropagation();
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank");
      }}
      style={{
        padding: "4px 10px", height: "auto", whiteSpace: "nowrap",
      }}>
      지도
    </Button>
  );
}
