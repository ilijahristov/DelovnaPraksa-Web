import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Страницата не постои"
      action={
        <Link to="/" className="btn btn-secondary">
          Назад на почетна
        </Link>
      }
    >
      Линкот е можеби погрешен или страницата е отстранета.
    </EmptyState>
  );
}
