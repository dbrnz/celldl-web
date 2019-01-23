#!/bin/sh
rm -rf ./tiles/$1/
rm -f ./tiles/tile.png
rm -f ./tiles/alpha.png
#
svgexport ./images/$1.svg ./tiles/tile.png 200:0:400:720 25x
convert ./tiles/tile.png -fuzz 5% -transparent white ./tiles/alpha.png
~/build/flatmaps/gdal2tiles.py -p raster -w none -r average -t $1 -x ./tiles/alpha.png ./tiles/$1/
