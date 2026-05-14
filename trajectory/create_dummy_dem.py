import numpy as np
import rasterio
from rasterio.transform import from_origin
import os

def create_dummy_dem():
    print("Generating Dummy Digital Elevation Model (GeoTIFF)...")
    
    # Define bounds (Lon: 80 to 120, Lat: -30 to 20)
    # This covers our Indian Ocean drop zonje
    width = 400
    height = 500
    res_x = (120.0 - 80.0) / width
    res_y = (20.0 - (-30.0)) / height
    
    # Create an elevation array
    # Let's make a "mountain range" near the end of the trajectory
    # and "ocean" (elevation 0) everywhere else
    elevation = np.zeros((height, width), dtype=np.float32)
    
    # Add a massive 4000m mountain peak near Lon 90, Lat 0 (Sumatra region roughly)
    for i in range(height):
        for j in range(width):
            lon = 80.0 + j * res_x
            lat = 20.0 - i * res_y # Top to bottom
            
            # Distance from our fake mountain peak (Lon 90, Lat 0)
            dist = np.sqrt((lon - 90.0)**2 + (lat - 0.0)**2)
            if dist < 10.0:
                # Mountain rising to 4000m
                elevation[i, j] = 4000.0 * (1 - dist/10.0)
    
    # Save as GeoTIFF using rasterio
    transform = from_origin(80.0, 20.0, res_x, res_y)
    
    output_dir = "trajectory"
    os.makedirs(output_dir, exist_ok=True)
    tiff_path = os.path.join(output_dir, "indian_ocean_dem.tif")
    
    with rasterio.open(
        tiff_path,
        'w',
        driver='GTiff',
        height=elevation.shape[0],
        width=elevation.shape[1],
        count=1,
        dtype=elevation.dtype,
        crs='+proj=latlong',
        transform=transform,
    ) as dst:
        dst.write(elevation, 1)
        
    print(f"Dummy DEM saved to {tiff_path}")

if __name__ == "__main__":
    create_dummy_dem()
