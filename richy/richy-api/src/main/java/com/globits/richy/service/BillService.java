package com.globits.richy.service;

import java.util.List;

import org.springframework.data.domain.Page;

import com.globits.richy.dto.BillDto;
import com.globits.richy.dto.BillStatisticsDto;

public interface BillService {
	public Page<BillDto> getPageObject(BillDto searchDto, int pageIndex, int pageSize);
	public List<BillDto> getListObject(BillDto searchDto, int pageIndex, int pageSize);
	public BillDto getObjectById(Long id);
	public boolean saveObject(BillDto dto);
	public boolean deleteObject(Long id);
	public BillStatisticsDto getBillStatistics(BillDto searchDto);
}
