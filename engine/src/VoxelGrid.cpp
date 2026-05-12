#include "VoxelGrid.hpp"

namespace metshield { 

void VoxelGrid::stepThermalFDM(float alpha, float dt) {
   
    std::vector<float> next_temp(m_data.size(), 0.0f);

   
    for(size_t z = 1; z < m_depth - 1; z++) {
        for(size_t y = 1; y < m_height - 1; y++) {
            for(size_t x = 1; x < m_width - 1; x++) {
                
                float T_center = getTemp(x,y,z);
                
                // Getting the temperatures of the neighbours
                float T_left   = getTemp(x-1,y,z);
                float T_right  = getTemp(x+1,y,z);
                float T_bottom = getTemp(x,y-1,z);
                float T_top    = getTemp(x,y+1,z);
                float T_back   = getTemp(x,y,z-1);
                float T_front  = getTemp(x,y,z+1);
                
                // Calculating the temperature of the next time step dt
                float lap = T_left+T_right+T_bottom+T_top+T_back+T_front - 6*T_center;
                
                
                float delta_temp = alpha * dt * lap;
                
                next_temp[getIndex(x,y,z)] = T_center + delta_temp;
            }
        }
    }

    /
    for (size_t z = 1; z < m_depth - 1; ++z) {
        for (size_t y = 1; y < m_height - 1; ++y) {
            for (size_t x = 1; x < m_width - 1; ++x) {
                setTemp(x, y, z, next_temp[getIndex(x, y, z)]);
            }
        }
    }
}

} // namespace metshield
