package com.globits.richy.dto;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

/** Public allow-list: only scores, names and birth dates visible in the shared table. */
public class PublicStudentMarkTableDto {
    private String className,programName,filterDescription;
    private Date refreshedAt=new Date();
    private List<Column> columns=new ArrayList<Column>();
    private List<Row> rows=new ArrayList<Row>();
    public String getClassName(){return className;}public void setClassName(String v){className=v;}
    public String getProgramName(){return programName;}public void setProgramName(String v){programName=v;}
    public String getFilterDescription(){return filterDescription;}public void setFilterDescription(String v){filterDescription=v;}
    public Date getRefreshedAt(){return refreshedAt;}public List<Column> getColumns(){return columns;}
    public List<Row> getRows(){return rows;}
    public static class Column {
        private String name;
        private Integer coefficient;
        public Column(String n,Integer c){name=n;coefficient=c;}
        public String getName(){return name;}public Integer getCoefficient(){return coefficient;}
    }
    public static class Row {
        private String name,birthDate,sortKey;
        private List<Double> marks=new ArrayList<Double>();
        public Row(String n,String b,String k){name=n;birthDate=b;sortKey=k;}
        public String getName(){return name;}public String getBirthDate(){return birthDate;}
        @com.fasterxml.jackson.annotation.JsonIgnore
        public String getSortKey(){return sortKey;}
        public List<Double> getMarks(){return marks;}
    }
}
