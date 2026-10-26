// 精简版 Phaser（仅正式构建通过 vite alias 使用，开发和测试仍用完整版 phaser）。
// 只打包游戏用到的模块：WebGL+Canvas 渲染、场景/相机/输入/补间/计时、Matter 物理，
// 以及 Text / Image / Graphics / Container / 基础图形。去掉了 Arcade 物理、Tilemap、
// 声音（音效走平台层 WebAudio / wx 音频）、粒子、BitmapText、视频、Mesh 等。
// 新增用到的 Phaser 功能时，需要在这里补上对应模块，否则正式包会在运行时报 undefined。
import 'phaser/src/polyfills/requestVideoFrame';
import CONST from 'phaser/src/const';
import Extend from 'phaser/src/utils/object/Extend';

import Animations from 'phaser/src/animations';
import BlendModes from 'phaser/src/renderer/BlendModes';
import Cache from 'phaser/src/cache';
import Cameras2D from 'phaser/src/cameras/2d';
import Core from 'phaser/src/core';
import Class from 'phaser/src/utils/Class';
import Data from 'phaser/src/data';
import DisplayMasks from 'phaser/src/display/mask';
import Events from 'phaser/src/events';
import Game from 'phaser/src/core/Game';
import Input from 'phaser/src/input';
import LoaderPlugin from 'phaser/src/loader/LoaderPlugin';
import ImageFile from 'phaser/src/loader/filetypes/ImageFile';
import AtlasJSONFile from 'phaser/src/loader/filetypes/AtlasJSONFile';
import Plugins from 'phaser/src/plugins';
import Renderer from 'phaser/src/renderer';
import Scale from 'phaser/src/scale';
import ScaleModes from 'phaser/src/renderer/ScaleModes';
import Scene from 'phaser/src/scene/Scene';
import Scenes from 'phaser/src/scene';
import Structs from 'phaser/src/structs';
import Textures from 'phaser/src/textures';
import Time from 'phaser/src/time';
import Tweens from 'phaser/src/tweens';
import PhysicsMatter from 'phaser/src/physics/matter-js';

import Clamp from 'phaser/src/math/Clamp';
import Between from 'phaser/src/math/Between';
import FloatBetween from 'phaser/src/math/FloatBetween';
import DegToRad from 'phaser/src/math/DegToRad';
import RadToDeg from 'phaser/src/math/RadToDeg';
import Distance from 'phaser/src/math/distance';
import Angle from 'phaser/src/math/angle';
import Easing from 'phaser/src/math/easing';
import Linear from 'phaser/src/math/Linear';
import Vector2 from 'phaser/src/math/Vector2';

import DisplayList from 'phaser/src/gameobjects/DisplayList';
import UpdateList from 'phaser/src/gameobjects/UpdateList';
import GameObjectFactory from 'phaser/src/gameobjects/GameObjectFactory';
import GameObjectCreator from 'phaser/src/gameobjects/GameObjectCreator';
import Components from 'phaser/src/gameobjects/components';
import GameObject from 'phaser/src/gameobjects/GameObject';
import Container from 'phaser/src/gameobjects/container/Container';
import Graphics from 'phaser/src/gameobjects/graphics/Graphics';
import Image from 'phaser/src/gameobjects/image/Image';
import Sprite from 'phaser/src/gameobjects/sprite/Sprite';
import Text from 'phaser/src/gameobjects/text/Text';
import Shape from 'phaser/src/gameobjects/shape/Shape';
import Arc from 'phaser/src/gameobjects/shape/arc/Arc';
import Line from 'phaser/src/gameobjects/shape/line/Line';
import Rectangle from 'phaser/src/gameobjects/shape/rectangle/Rectangle';
import Triangle from 'phaser/src/gameobjects/shape/triangle/Triangle';
// 工厂文件在 import 时把 add.xxx 注册到 GameObjectFactory。
import 'phaser/src/gameobjects/container/ContainerFactory';
import 'phaser/src/gameobjects/graphics/GraphicsFactory';
import 'phaser/src/gameobjects/image/ImageFactory';
import 'phaser/src/gameobjects/sprite/SpriteFactory';
import 'phaser/src/gameobjects/text/TextFactory';
import 'phaser/src/gameobjects/shape/arc/ArcFactory';
import 'phaser/src/gameobjects/shape/line/LineFactory';
import 'phaser/src/gameobjects/shape/rectangle/RectangleFactory';
import 'phaser/src/gameobjects/shape/triangle/TriangleFactory';

const Phaser = Extend(false, {
  Animations,
  BlendModes,
  Cache,
  Cameras: { Scene2D: Cameras2D },
  Core,
  Class,
  Data,
  Display: { Masks: DisplayMasks },
  Events,
  Game,
  GameObjects: {
    DisplayList, UpdateList, GameObjectFactory, GameObjectCreator, Components, GameObject,
    Container, Graphics, Image, Sprite, Text, Shape, Arc, Line, Rectangle, Triangle
  },
  Input,
  Loader: { LoaderPlugin, FileTypes: { ImageFile, AtlasJSONFile } },
  Math: { Clamp, Between, FloatBetween, DegToRad, RadToDeg, Distance, Angle, Easing, Linear, Vector2 },
  Physics: { Matter: PhysicsMatter },
  Plugins,
  Renderer,
  Scale,
  ScaleModes,
  Scene,
  Scenes,
  Structs,
  Textures,
  Time,
  Tweens
}, CONST);

export default Phaser;
