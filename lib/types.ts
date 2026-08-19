// Типы сущностей, приходящих из API booomerangs.ru.
// Поля опциональны — сервер местами отдаёт разную форму (legacy-данные).

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role?: string;
  emailVerified?: boolean;
}

export interface Product {
  id: number;
  name: string;
  slug?: string;
  price: number;
  oldPrice?: number | null;
  salePrice?: number | null;
  discountPercent?: number | null;
  onSale?: boolean;
  isNew?: boolean;
  category?: string;
  subcategory?: string;
  subSubcategory?: string;
  color?: string;
  colors?: string[];
  sizes?: string[] | string;
  images?: string[];
  image?: string;
  imageUrl?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  stock?: number;
  isHidden?: boolean;
  description?: string;
  videoUrl?: string;
  badge?: string;
  badgeText?: string;
  measurements?: string;
  sku?: string;
  wholesalePrice?: number;
  artistSlug?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface OrderItem {
  productId?: number;
  name?: string;
  price?: number;
  quantity?: number;
  size?: string;
  color?: string;
  image?: string;
  [key: string]: unknown;
}

export interface Order {
  id: number;
  orderNumber?: number | string;
  createdAt?: string;
  status?: string;
  total?: number;
  items?: OrderItem[];
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  deliveryMethod?: string;
  city?: string;
  address?: string;
  paymentMethod?: string;
  comment?: string;
  isDraft?: boolean;
  isWholesale?: boolean;
  pickupPoint?: string;
  [key: string]: unknown;
}

export interface Client {
  id: number;
  email: string;
  name?: string;
  phone?: string;
  role?: string;
  emailVerified?: boolean;
  createdAt?: string;
  totalSpent?: number;
  loyaltyDiscount?: number;
  [key: string]: unknown;
}

export interface WholesaleClient {
  id: number;
  email: string;
  name?: string;
  companyName?: string | null;
  inn?: string | null;
  kpp?: string | null;
  legalAddress?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  wholesaleApproved?: boolean;
  wholesaleDiscount?: number;
  createdAt?: string;
  [key: string]: unknown;
}

export interface Review {
  id: number;
  productId?: number;
  productName?: string;
  rating?: number;
  text?: string;
  comment?: string;
  author?: string;
  authorName?: string;
  createdAt?: string;
  approved?: boolean;
  isApproved?: boolean;
  status?: string;
  [key: string]: unknown;
}

export interface PromoCode {
  id: number;
  code: string;
  discount?: number;
  active?: boolean;
  [key: string]: unknown;
}
