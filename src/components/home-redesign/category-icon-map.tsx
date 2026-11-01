import { BicycleIcon } from "phosphor-react-native/src/icons/Bicycle";
import { BooksIcon } from "phosphor-react-native/src/icons/Books";
import { CarrotIcon } from "phosphor-react-native/src/icons/Carrot";
import { CouchIcon } from "phosphor-react-native/src/icons/Couch";
import { DiamondIcon } from "phosphor-react-native/src/icons/Diamond";
import { GameControllerIcon } from "phosphor-react-native/src/icons/GameController";
import { FlowerIcon } from "phosphor-react-native/src/icons/Flower";
import { HammerIcon } from "phosphor-react-native/src/icons/Hammer";
import { HandbagIcon } from "phosphor-react-native/src/icons/Handbag";
import { MonitorIcon } from "phosphor-react-native/src/icons/Monitor";
import { MusicNotesIcon } from "phosphor-react-native/src/icons/MusicNotes";
import { PaintBrushIcon } from "phosphor-react-native/src/icons/PaintBrush";
import { PawPrintIcon } from "phosphor-react-native/src/icons/PawPrint";
import { PlantIcon } from "phosphor-react-native/src/icons/Plant";
import { PackageIcon } from "phosphor-react-native/src/icons/Package";
import { PuzzlePieceIcon } from "phosphor-react-native/src/icons/PuzzlePiece";
import { SoccerBallIcon } from "phosphor-react-native/src/icons/SoccerBall";
import { SquaresFourIcon } from "phosphor-react-native/src/icons/SquaresFour";
import { TShirtIcon } from "phosphor-react-native/src/icons/TShirt";
import { WatchIcon } from "phosphor-react-native/src/icons/Watch";
import type { Icon } from "phosphor-react-native";

import type { Category } from "../../api/post";

export const HOME_CATEGORY_ICONS: Readonly<Record<Category, Icon>> = {
  ELECTRONICS: MonitorIcon,
  CLOTHING: TShirtIcon,
  BAGS: HandbagIcon,
  BEAUTY: FlowerIcon,
  ACCESSORIES: WatchIcon,
  FURNITURE: CouchIcon,
  BOOKS: BooksIcon,
  GAMING: GameControllerIcon,
  SPORTS: SoccerBallIcon,
  BIKES: BicycleIcon,
  TOYS: PuzzlePieceIcon,
  TOOLS: HammerIcon,
  MUSIC: MusicNotesIcon,
  ART: PaintBrushIcon,
  COLLECTIBLES: DiamondIcon,
  PETS: PawPrintIcon,
  PLANTS: PlantIcon,
  FOOD: CarrotIcon,
  OTHER: PackageIcon,
};

export const FALLBACK_CATEGORY_ICON: Icon = SquaresFourIcon;
