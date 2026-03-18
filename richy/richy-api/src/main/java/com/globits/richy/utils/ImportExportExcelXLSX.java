package com.globits.richy.utils;

import java.io.DataOutput;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.text.DateFormat;
import java.text.DecimalFormat;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.servlet.ServletOutputStream;

import org.apache.batik.css.engine.value.css2.FontWeightManager;
import org.apache.poi.hssf.usermodel.HSSFCellStyle;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.poifs.filesystem.POIFSFileSystem;
import org.apache.poi.ss.usermodel.BorderExtent;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.CreationHelper;
import org.apache.poi.ss.usermodel.DataFormat;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.ss.util.PropertyTemplate;
import org.apache.poi.ss.util.RegionUtil;
import org.apache.poi.xssf.usermodel.XSSFCell;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.joda.time.LocalDateTime;

import com.globits.richy.dto.BodyDto;

public class ImportExportExcelXLSX {
	
	public static void exportBody(List<BodyDto> dto, ServletOutputStream out,
			InputStream ip) throws IOException {
		XSSFWorkbook workbook = new XSSFWorkbook(ip);	

		Sheet sheet = null;
		sheet = workbook.getSheetAt(0);
		CellStyle cellStyle = workbook.createCellStyle();
		cellStyle.setBorderTop(BorderStyle.THIN);
        cellStyle.setBorderBottom(BorderStyle.THIN);
        cellStyle.setBorderLeft(BorderStyle.THIN);
        cellStyle.setBorderRight(BorderStyle.THIN);
        
        Font font = workbook.createFont();
        font.setColor(IndexedColors.BLACK.getIndex());
		font.setFontName("Time New Roman");
		int fontSize = 13;
		font.setFontHeightInPoints((short) fontSize);
		cellStyle.setFont(font);
		
		//1-10
		int rowIndex = 1; //hàng bắt đầu
		int index=0;
		int ordinalNumber = 1;
		for (BodyDto item : dto) {
			
			Row row = sheet.createRow(rowIndex);
			
			
			if(index == 0) {
				Cell cell = row.createCell(0);
				cell.setCellValue(" ");
				cell.setCellStyle(cellStyle);
				
				
				cell = row.createCell(1);
				cell.setCellValue("Gói số " + ordinalNumber);
				cell.setCellStyle(cellStyle);
				ordinalNumber++;
				
				rowIndex++;
				index++;
				
				row = sheet.createRow(rowIndex);
				
				cell = row.createCell(0);
				cell.setCellValue(index);
				cell.setCellStyle(cellStyle);
				
				cell = row.createCell(1);
				cell.setCellValue(item.getText());
				cell.setCellStyle(cellStyle);
			} else {
				Cell cell = row.createCell(0);
				cell.setCellValue(index);
				cell.setCellStyle(cellStyle);
				
				cell = row.createCell(1);
				cell.setCellValue(item.getText());
				cell.setCellStyle(cellStyle);
			}
			
			
			if (index < 10 ) {
				index++;
			} else {
				index = 0;
			}
			
			rowIndex++;
			
		}
		
		
		//1-5 6-10
//		int rowIndex = 1; //hàng bắt đầu
//		int index=1;
//		int quantity = dto.size() / 2;
//		boolean right = true;
//		boolean notChange = false;
//		int count = 0;
//		for (BodyDto item : dto) {
////			Row row = sheet.createRow(rowIndex);
//
//			if(right == true) {
//				
//				Row row = sheet.createRow(rowIndex);
//				
//				Cell cell = row.createCell(0);
//				cell.setCellValue(index);
//				cell.setCellStyle(cellStyle);
//				
//				cell = row.createCell(1);
//				cell.setCellValue(item.getText());
//				cell.setCellStyle(cellStyle);
//				
//				index++;
//				if(index > 5) {
//					index = 1;
//					rowIndex++;
//					count++;
//					int ordinalNumber = count + 1;
//					Row row2 = sheet.createRow(rowIndex);
//					Cell cell2 = row2.createCell(1);
//					cell2.setCellValue("Gói số " + ordinalNumber);
//					cell2.setCellStyle(cellStyle);
//					
//				}
//				rowIndex++;
//			}
//			
//			if(rowIndex == quantity + count && notChange == false) {
//				right = false;
//				notChange = true;
//				index = 6;
//				rowIndex = 1;
//			}
//			
//			if(right == false) {
//				
//				Row row = sheet.getRow(rowIndex);
//				if(row == null) {
//					row = sheet.createRow(rowIndex);
//				}
//				
//				Cell cell = row.createCell(2);
//				cell.setCellValue(index);
//				cell.setCellStyle(cellStyle);
//				
//				cell = row.createCell(3);
//				cell.setCellValue(item.getText());
//				cell.setCellStyle(cellStyle);
//				
//				index++;
//				if(index > 10) {
//					index = 6;
//					rowIndex++;
//				}
//				rowIndex++;
//			}
//			
//			
//		}
//		
//		System.out.println(count);
		
		for (int j = 1; j < 4; j++) {
			sheet.autoSizeColumn(j, false);
		}

		workbook.write(out);
		workbook.close();
		
	}
	
	public static void main  (String [] args) {
		String clientText = "Tháng Mười Một − 2020";
		
		clientText = clientText.replaceAll("[\\[\\].\n\",:?'(){};-=/]", "");
		clientText = clientText.replaceAll("-", "");
		clientText = clientText.replaceAll("−", "");
		clientText = clientText.replaceAll("“", "");
		clientText = clientText.replaceAll("”", "");
		System.out.println(clientText);
		clientText = clientText.trim();
		clientText = clientText.toLowerCase();
		clientText = clientText.replaceAll("\\s{2,}", " ").trim();
		String[] listClientText = clientText.split(" ");
		clientText = clientText.replaceAll(" ", "");
//		clientText = deAccent(clientText);
	}
}
